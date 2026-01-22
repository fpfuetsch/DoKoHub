import { beforeEach, describe, expect, it } from 'vitest';
import { PlayerRepository } from './player';
import { GroupRepository } from './group';
import { GameRepository } from './game';
import { db } from '$lib/server/db';
import {
	GroupMemberTable,
	GroupTable,
	PlayerTable,
	GameTable,
	GameParticipantTable,
	GameRoundTable,
	GameRoundParticipantTable,
	GameRoundCallTable,
	GameRoundBonusTable,
	GameRoundResultTable
} from '$lib/server/db/schema';
import { AuthProvider } from '$lib/server/enums';
import { and, eq } from 'drizzle-orm';

describe('PlayerRepository', () => {
	let principalId: string;
	let groupId: string;
	let repo: PlayerRepository;
	let groupRepo: GroupRepository;

	beforeEach(async () => {
		// cleanup all related tables (respect FK order)
		await db.delete(GameRoundCallTable);
		await db.delete(GameRoundBonusTable);
		await db.delete(GameRoundResultTable);
		await db.delete(GameRoundParticipantTable);
		await db.delete(GameRoundTable);
		await db.delete(GameParticipantTable);
		await db.delete(GameTable);
		await db.delete(GroupMemberTable);
		await db.delete(GroupTable);
		await db.delete(PlayerTable);

		// create principal (non-local target)
		const base = new PlayerRepository();
		const principal = await base.create({
			displayName: 'Principal',
			authProvider: AuthProvider.Google,
			authProviderId: 'google|principal'
		});
		principalId = principal.id;

		// create group for principal
		groupRepo = new GroupRepository(principalId);
		const g = await groupRepo.create('Test Group');
		if (!g.ok) throw new Error('Failed to create group');
		groupId = g.value.id;

		repo = new PlayerRepository(principalId);
	});

	describe('basic getters', () => {
		it('getById and getByProvider return null when not found', async () => {
			const none = await repo.getById('00000000-0000-0000-0000-000000000000');
			expect(none).toBeNull();
			const none2 = await repo.getByProvider(AuthProvider.Google, 'missing');
			expect(none2).toBeNull();
		});

		it('create and fetch by provider', async () => {
			const p = await repo.create({
				displayName: 'A',
				authProvider: AuthProvider.Google,
				authProviderId: 'g|1'
			});
			const byId = await repo.getById(p.id);
			expect(byId?.displayName).toBe('A');
			const byProv = await repo.getByProvider(AuthProvider.Google, 'g|1');
			expect(byProv?.id).toBe(p.id);
		});
	});

	describe('rename (self)', () => {
		it('requires principal', async () => {
			const anonRepo = new PlayerRepository();
			const res = await anonRepo.rename('New Name');
			expect(res).toEqual({ ok: false, error: 'Unauthorized', status: 401 });
		});

		it('validates display name', async () => {
			const res = await repo.rename('ab');
			expect(res).toEqual({ ok: false, error: 'Mindestens 3 Zeichen notwendig.', status: 400 });
		});

		it('renames successfully', async () => {
			const res = await repo.rename('Renamed');
			expect(res).toEqual({ ok: true, value: undefined });
			const after = await repo.getById(principalId);
			expect(after?.displayName).toBe('Renamed');
		});
	});

	describe('createLocal', () => {
		it('requires membership', async () => {
			// other user creates a group
			const otherBase = new PlayerRepository();
			const other = await otherBase.create({
				displayName: 'Other',
				authProvider: AuthProvider.Google,
				authProviderId: 'g|x'
			});
			const otherRepo = new GroupRepository(other.id);
			const g = await otherRepo.create('Other Group');
			if (!g.ok) throw new Error('Failed to create');

			const res = await repo.createLocal('Local P', g.value.id);
			expect(res).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('validates display name', async () => {
			const res = await repo.createLocal('ab', groupId);
			expect(res).toEqual({ ok: false, error: 'Mindestens 3 Zeichen notwendig.', status: 400 });
		});

		it('creates local player and membership', async () => {
			const res = await repo.createLocal('Local Player', groupId);
			expect(res.ok).toBe(true);
			if (res.ok) {
				expect(res.value.authProvider).toBe(AuthProvider.Local);
				const membership = await db
					.select()
					.from(GroupMemberTable)
					.where(
						and(eq(GroupMemberTable.groupId, groupId), eq(GroupMemberTable.playerId, res.value.id))
					);
				expect(membership.length).toBe(1);
			}
		});
	});

	describe('deleteLocal', () => {
		it('requires membership', async () => {
			// new group owned by other
			const otherBase = new PlayerRepository();
			const other = await otherBase.create({
				displayName: 'Other',
				authProvider: AuthProvider.Google,
				authProviderId: 'g|y'
			});
			const otherGroupRepo = new GroupRepository(other.id);
			const g = await otherGroupRepo.create('Other Group');
			if (!g.ok) throw new Error('Failed to create');

			// create a local player in other group via their repo
			const otherPlayerRepo = new PlayerRepository(other.id);
			const localInOther = await otherPlayerRepo.createLocal('Local O', g.value.id);
			if (!localInOther.ok) throw new Error('Failed to create local');

			const res = await repo.deleteLocal(localInOther.value.id, g.value.id);
			expect(res).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('only local players can be deleted', async () => {
			const nonLocal = await repo.create({
				displayName: 'NonLocal',
				authProvider: AuthProvider.Google,
				authProviderId: 'g|z'
			});
			const res = await repo.deleteLocal(nonLocal.id, groupId);
			expect(res).toEqual({ ok: false, error: 'Nur lokale Spieler erlaubt.', status: 400 });
		});

		it('prevents deletion when participations exist', async () => {
			// create local and add to a game
			const localRes = await repo.createLocal('Local P', groupId);
			if (!localRes.ok) throw new Error('Failed to create local');

			const gameRepo = new GameRepository(principalId);
			const p2 = await repo.create({
				displayName: 'P2',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const p3 = await repo.create({
				displayName: 'P3',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const p4 = await repo.create({
				displayName: 'P4',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const createGame = await gameRepo.create(groupId, 24, true, [
				localRes.value.id,
				p2.id,
				p3.id,
				p4.id
			]);
			if (!createGame.ok) throw new Error('Failed to create game');

			const res = await repo.deleteLocal(localRes.value.id, groupId);
			expect(res).toEqual({
				ok: false,
				status: 400,
				error:
					'Lokaler Spieler war an Spielen/Runden beteiligt. Lösche entweder zuerst alle betreffenden Spiele oder übernehme den lokalen Spieler.'
			});
		});

		it('deletes when no participations', async () => {
			const localRes = await repo.createLocal('Local Q', groupId);
			if (!localRes.ok) throw new Error('Failed to create local');
			const res = await repo.deleteLocal(localRes.value.id, groupId);
			expect(res).toEqual({ ok: true, value: undefined });
			const still = await repo.getById(localRes.value.id);
			expect(still).toBeNull();
		});
	});

	describe('renameLocal', () => {
		it('requires membership', async () => {
			const otherBase = new PlayerRepository();
			const other = await otherBase.create({
				displayName: 'Other',
				authProvider: AuthProvider.Google,
				authProviderId: 'g|a'
			});
			const otherGroupRepo = new GroupRepository(other.id);
			const g = await otherGroupRepo.create('Other Group');
			if (!g.ok) throw new Error('Failed');
			const otherPlayerRepo = new PlayerRepository(other.id);
			const localOther = await otherPlayerRepo.createLocal('Local O', g.value.id);
			if (!localOther.ok) throw new Error('Failed local');

			const res = await repo.renameLocal(localOther.value.id, g.value.id, 'X');
			expect(res).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('only local players can be renamed', async () => {
			const nonLocal = await repo.create({
				displayName: 'NonLocal',
				authProvider: AuthProvider.Google,
				authProviderId: 'g|b'
			});
			const res = await repo.renameLocal(nonLocal.id, groupId, 'New');
			expect(res).toEqual({ ok: false, error: 'Nur lokale Spieler erlaubt.', status: 400 });
		});

		it('validates name and renames', async () => {
			const localRes = await repo.createLocal('Local R', groupId);
			if (!localRes.ok) throw new Error('Failed');
			const bad = await repo.renameLocal(localRes.value.id, groupId, 'ab');
			expect(bad).toEqual({ ok: false, error: 'Mindestens 3 Zeichen notwendig.', status: 400 });
			const okRes = await repo.renameLocal(localRes.value.id, groupId, 'Local R2');
			expect(okRes).toEqual({ ok: true, value: undefined });
			const after = await repo.getById(localRes.value.id);
			expect(after?.displayName).toBe('Local R2');
		});
	});

	describe('takeoverLocalPlayer', () => {
		it('requires membership of group', async () => {
			const localInOther = await new PlayerRepository(principalId).create({
				displayName: 'Local S',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			// make a foreign group with other user
			const other = await new PlayerRepository().create({
				displayName: 'Other',
				authProvider: AuthProvider.Google,
				authProviderId: 'g|c'
			});
			const otherGroup = await new GroupRepository(other.id).create('Other');
			if (!otherGroup.ok) throw new Error('Failed');
			await new GroupRepository(other.id).addMember(otherGroup.value.id, localInOther.id, true);

			const res = await repo.takeoverLocalPlayer(localInOther.id, otherGroup.value.id);
			expect(res).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('validates local and target types', async () => {
			const notLocal = await repo.create({
				displayName: 'NonLocal',
				authProvider: AuthProvider.Google,
				authProviderId: 'g|t'
			});
			const res1 = await repo.takeoverLocalPlayer(notLocal.id, groupId);
			expect(res1).toEqual({
				ok: false,
				error: 'Quellspieler ist kein lokaler Spieler.',
				status: 400
			});

			// target must be non-local: use a local principal
			const localPrincipal = await new PlayerRepository().create({
				displayName: 'Local Principal',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			// add local principal to group
			await groupRepo.addMember(groupId, localPrincipal.id);
			const localPrincipalRepo = new PlayerRepository(localPrincipal.id);
			const localToTake = await repo.createLocal('Local T', groupId);
			if (!localToTake.ok) throw new Error('Failed');
			const res2 = await localPrincipalRepo.takeoverLocalPlayer(localToTake.value.id, groupId);
			expect(res2).toEqual({
				ok: false,
				error: 'Zielspieler darf kein lokaler Spieler sein.',
				status: 400
			});
		});

		it('fails when both participated in the same game', async () => {
			const localRes = await repo.createLocal('Local U', groupId);
			if (!localRes.ok) throw new Error('Failed');
			// create a game and add both principal and local
			const game = await db
				.insert(GameTable)
				.values({ groupId, maxRoundCount: 24, withMandatorySolos: true })
				.returning();
			const gameId = game[0].id as string;
			await db
				.insert(GameParticipantTable)
				.values({ gameId, playerId: localRes.value.id, seatPosition: 0 });
			await db
				.insert(GameParticipantTable)
				.values({ gameId, playerId: principalId, seatPosition: 1 });

			const res = await repo.takeoverLocalPlayer(localRes.value.id, groupId);
			expect(res).toEqual({
				ok: false,
				error:
					'Du hast bereits mit dem lokalen Spieler an einem Spiel teilgenommen. Übernahme nicht möglich.',
				status: 400
			});
		});

		it('succeeds and transfers memberships and references', async () => {
			const localRes = await repo.createLocal('Local V', groupId);
			if (!localRes.ok) throw new Error('Failed');
			// create a game where only local participated
			const game = await db
				.insert(GameTable)
				.values({ groupId, maxRoundCount: 24, withMandatorySolos: false })
				.returning();
			const gameId = game[0].id as string;
			await db
				.insert(GameParticipantTable)
				.values({ gameId, playerId: localRes.value.id, seatPosition: 0 });

			const res = await repo.takeoverLocalPlayer(localRes.value.id, groupId);
			expect(res).toEqual({ ok: true, value: undefined });

			// local player deleted
			const gone = await repo.getById(localRes.value.id);
			expect(gone).toBeNull();

			// reference transferred
			const parts = await db
				.select()
				.from(GameParticipantTable)
				.where(
					and(
						eq(GameParticipantTable.gameId, gameId),
						eq(GameParticipantTable.playerId, principalId)
					)
				);
			expect(parts.length).toBe(1);

			// no duplicate membership remains
			const members = await db
				.select()
				.from(GroupMemberTable)
				.where(
					and(eq(GroupMemberTable.groupId, groupId), eq(GroupMemberTable.playerId, principalId))
				);
			expect(members.length).toBe(1);
		});
	});
});
