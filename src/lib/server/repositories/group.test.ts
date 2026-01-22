import { beforeEach, describe, expect, it } from 'vitest';
import { GroupRepository } from './group';
import { PlayerRepository } from './player';
import { db } from '$lib/server/db';
import { GroupMemberTable, GroupTable, PlayerTable } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { AuthProvider } from '$lib/server/enums';

describe('GroupRepository', () => {
	let repo: GroupRepository;
	let playerRepo: PlayerRepository;
	let principalId: string;

	beforeEach(async () => {
		// Cleanup
		await db.delete(GroupMemberTable);
		await db.delete(GroupTable);
		await db.delete(PlayerTable);

		// Create principal (non-local to test leave semantics)
		playerRepo = new PlayerRepository();
		const principal = await playerRepo.create({
			displayName: 'Principal',
			authProvider: AuthProvider.Google,
			authProviderId: 'google|principal'
		});
		principalId = principal.id;
		repo = new GroupRepository(principalId);
	});

	describe('list / getById', () => {
		it('returns empty list when user has no groups', async () => {
			const groups = await repo.list();
			expect(groups).toEqual([]);
		});

		it('lists only groups where user is a member (isolation)', async () => {
			// Create two groups for principal
			const g1 = await repo.create('Alpha');
			const g2 = await repo.create('Beta');
			if (!g1.ok || !g2.ok) throw new Error('Failed to create groups');

			// Create another user + group
			const other = await playerRepo.create({
				displayName: 'Other User',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRepo = new GroupRepository(other.id);
			const g3 = await otherRepo.create('Gamma');
			if (!g3.ok) throw new Error('Failed to create other group');

			const list = await repo.list();
			expect(list).toHaveLength(2);

			// access to other user's group should be denied
			const getOther = await repo.getById(g3.value.id);
			expect(getOther).toEqual({
				ok: false,
				error: 'Gruppe nicht gefunden oder keine Berechtigung.',
				status: 404
			});
		});
	});

	describe('create', () => {
		it('validates group name', async () => {
			const result = await repo.create('ab');
			expect(result).toEqual({ ok: false, error: 'Mindestens 3 Zeichen notwendig.', status: 400 });
		});

		it('creates group with principal and unique members', async () => {
			const p1 = await playerRepo.create({
				displayName: 'Member A',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const p2 = await playerRepo.create({
				displayName: 'Member B',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			// include duplicates and principal explicitly
			const result = await repo.create('My Group', [p1.id, p2.id, p1.id, principalId]);
			expect(result.ok).toBe(true);
			if (result.ok) {
				// principal + p1 + p2 => 3 members
				const ids = result.value.players.map((p) => p.id);
				expect(new Set(ids).size).toBe(3);
				expect(ids).toContain(principalId);
				expect(ids).toContain(p1.id);
				expect(ids).toContain(p2.id);
			}
		});
	});

	describe('rename', () => {
		it('requires membership', async () => {
			const other = await playerRepo.create({
				displayName: 'Other',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRepo = new GroupRepository(other.id);
			const g = await otherRepo.create('Other Group');
			if (!g.ok) throw new Error('Failed to create');
			const res = await repo.rename(g.value.id, 'New Name');
			expect(res).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('validates new name', async () => {
			const g = await repo.create('Initial');
			if (!g.ok) throw new Error('Failed to create');
			const res = await repo.rename(g.value.id, 'x');
			expect(res).toEqual({ ok: false, error: 'Mindestens 3 Zeichen notwendig.', status: 400 });
		});

		it('renames successfully', async () => {
			const g = await repo.create('Initial');
			if (!g.ok) throw new Error('Failed to create');
			const res = await repo.rename(g.value.id, 'Renamed');
			expect(res).toEqual({ ok: true, value: undefined });
			const after = await repo.getById(g.value.id);
			expect(after.ok).toBe(true);
			if (after.ok) expect(after.value.name).toBe('Renamed');
		});
	});

	describe('addMember', () => {
		it('requires membership when not using invitation', async () => {
			const other = await playerRepo.create({
				displayName: 'Other',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRepo = new GroupRepository(other.id);
			const g = await otherRepo.create('Other Group');
			if (!g.ok) throw new Error('Failed to create');
			const res = await repo.addMember(g.value.id, principalId, false);
			expect(res).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('using invitation validates group existence', async () => {
			const res = await repo.addMember('00000000-0000-0000-0000-000000000000', principalId, true);
			expect(res).toEqual({ ok: false, error: 'Gruppe nicht gefunden.', status: 404 });
		});

		it('adds member using invitation', async () => {
			// another user creates a group
			const other = await playerRepo.create({
				displayName: 'Other',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRepo = new GroupRepository(other.id);
			const g = await otherRepo.create('Invite Group');
			if (!g.ok) throw new Error('Failed to create');

			const res = await repo.addMember(g.value.id, principalId, true);
			expect(res).toEqual({ ok: true, value: undefined });

			const after = await repo.getById(g.value.id);
			expect(after.ok).toBe(true);
			if (after.ok) {
				const ids = after.value.players.map((p) => p.id);
				expect(ids).toContain(principalId);
			}
		});
	});

	describe('leave', () => {
		it('deletes group when last non-local user leaves', async () => {
			const g = await repo.create('Solo Group');
			if (!g.ok) throw new Error('Failed to create');
			// add some local players
			const lp1 = await playerRepo.create({
				displayName: 'Local 1',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const lp2 = await playerRepo.create({
				displayName: 'Local 2',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			await repo.addMember(g.value.id, lp1.id);
			await repo.addMember(g.value.id, lp2.id);

			const res = await repo.leave(g.value.id);
			expect(res.ok).toBe(true);
			if (res.ok) expect(res.value.deletedGroup).toBe(true);

			// group is gone
			const check = await db.select().from(GroupTable).where(eq(GroupTable.id, g.value.id));
			expect(check.length).toBe(0);
			// local players still exist as players (deleteLocal in delete() removes only when deleting group directly)
		});

		it('removes membership when other non-local members remain', async () => {
			const g = await repo.create('Team Group');
			if (!g.ok) throw new Error('Failed to create');
			// add another non-local member
			const nonLocal = await playerRepo.create({
				displayName: 'NonLocal',
				authProvider: AuthProvider.Google,
				authProviderId: 'google|x'
			});
			await repo.addMember(g.value.id, nonLocal.id);

			const res = await repo.leave(g.value.id);
			expect(res.ok).toBe(true);
			if (res.ok) expect(res.value.deletedGroup).toBe(false);

			// group still exists
			const exists = await db.select().from(GroupTable).where(eq(GroupTable.id, g.value.id));
			expect(exists.length).toBe(1);
			// membership removed
			const membership = await db
				.select()
				.from(GroupMemberTable)
				.where(
					and(eq(GroupMemberTable.groupId, g.value.id), eq(GroupMemberTable.playerId, principalId))
				);
			expect(membership.length).toBe(0);
		});
	});

	describe('delete', () => {
		it('requires membership', async () => {
			const other = await playerRepo.create({
				displayName: 'Other',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRepo = new GroupRepository(other.id);
			const g = await otherRepo.create('Other Group');
			if (!g.ok) throw new Error('Failed to create');
			const res = await repo.delete(g.value.id);
			expect(res).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('deletes group and local players', async () => {
			const g = await repo.create('Cleanup Group');
			if (!g.ok) throw new Error('Failed to create');
			// add a local player to this group
			const localP = await playerRepo.create({
				displayName: 'Local X',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			await repo.addMember(g.value.id, localP.id);

			// add a non-local player to ensure they are not deleted
			const nonLocal = await playerRepo.create({
				displayName: 'NonLocal',
				authProvider: AuthProvider.Google,
				authProviderId: 'google|y'
			});
			await repo.addMember(g.value.id, nonLocal.id);

			const res = await repo.delete(g.value.id);
			expect(res).toEqual({ ok: true, value: undefined });

			// group removed
			const groups = await db.select().from(GroupTable).where(eq(GroupTable.id, g.value.id));
			expect(groups.length).toBe(0);
			// local player removed
			const playersLocal = await db.select().from(PlayerTable).where(eq(PlayerTable.id, localP.id));
			expect(playersLocal.length).toBe(0);
			// non-local remains
			const playersNonLocal = await db
				.select()
				.from(PlayerTable)
				.where(eq(PlayerTable.id, nonLocal.id));
			expect(playersNonLocal.length).toBe(1);
		});
	});
});
