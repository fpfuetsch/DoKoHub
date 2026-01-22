import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoundRepository } from './round';
import { GameRepository } from './game';
import { GroupRepository } from './group';
import { PlayerRepository } from './player';
import { db } from '$lib/server/db';
import {
	GameRoundCallTable,
	GameRoundBonusTable,
	GameRoundResultTable,
	GameRoundParticipantTable,
	GameRoundTable,
	GameParticipantTable,
	GameTable,
	GroupMemberTable,
	GroupTable,
	PlayerTable
} from '$lib/server/db/schema';
import { Team, CallType, BonusType, RoundType, SoloType, AuthProvider } from '$lib/server/enums';
import type { RoundData } from '$lib/domain/round';
import { Round } from '$lib/domain/round';
import { Game } from '$lib/domain/game';
import { eq } from 'drizzle-orm';

// Helper to build a valid normal round draft with 4 participants
function makeNormalRoundDraft(p0: string, p1: string, p2: string, p3: string): RoundData {
	return {
		id: 'draft',
		roundNumber: 1,
		type: RoundType.Normal,
		soloType: null,
		eyesRe: 121,
		participants: [
			{
				playerId: p0,
				team: Team.RE,
				calls: [{ playerId: p0, callType: CallType.RE }],
				bonuses: []
			},
			{ playerId: p2, team: Team.RE, calls: [], bonuses: [] },
			{
				playerId: p1,
				team: Team.KONTRA,
				calls: [{ playerId: p1, callType: CallType.KONTRA }],
				bonuses: []
			},
			{ playerId: p3, team: Team.KONTRA, calls: [], bonuses: [] }
		]
	};
}

describe('RoundRepository', () => {
	let principalId: string;
	let groupId: string;
	let playerIds: string[];
	let gameId: string;
	let roundRepo: RoundRepository;
	let gameRepo: GameRepository;
	let groupRepo: GroupRepository;
	let playerRepo: PlayerRepository;

	beforeEach(async () => {
		// Cleanup respecting FKs
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

		playerRepo = new PlayerRepository();
		const principal = await playerRepo.create({
			displayName: 'Principal',
			authProvider: AuthProvider.Google,
			authProviderId: 'google|principal'
		});
		principalId = principal.id;

		groupRepo = new GroupRepository(principalId);
		const g = await groupRepo.create('Round Group');
		if (!g.ok) throw new Error('Failed to create group');
		groupId = g.value.id;

		// Create 5 players for a 5-player game (dealer sits out each round)
		playerIds = [];
		for (let i = 0; i < 5; i++) {
			const p = await playerRepo.create({
				displayName: `P${i + 1}`,
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			playerIds.push(p.id);
		}

		gameRepo = new GameRepository(principalId);
		const game = await gameRepo.create(groupId, 30, true, playerIds);
		if (!game.ok) throw new Error('Failed to create game');
		gameId = game.value.id;

		roundRepo = new RoundRepository(principalId);
	});

	describe('getRoundsForGame', () => {
		it('forbids access for non-members', async () => {
			const other = await playerRepo.create({
				displayName: 'Other',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRoundRepo = new RoundRepository(other.id);
			const res = await otherRoundRepo.getRoundsForGame(gameId, groupId);
			expect(res).toEqual({ ok: false, error: 'Forbidden.', status: 403 });
		});

		it('returns 404 when game not found', async () => {
			const res = await roundRepo.getRoundsForGame('00000000-0000-0000-0000-000000000000', groupId);
			expect(res).toEqual({ ok: false, error: 'Spiel nicht gefunden.', status: 404 });
		});

		it('returns empty list when no rounds exist (RED first)', async () => {
			const res = await roundRepo.getRoundsForGame(gameId, groupId);
			expect(res.ok).toBe(true);
			if (res.ok) {
				expect(res.value).toHaveLength(0);
			}
		});
	});

	describe('addRound', () => {
		it('calls Round.validate and Game.validate when creating', async () => {
			const spyRoundValidate = vi.spyOn(Round, 'validate');
			const spyGameValidate = vi.spyOn(Game, 'validate');

			const draft = makeNormalRoundDraft(playerIds[1], playerIds[2], playerIds[3], playerIds[4]);
			const res = await roundRepo.addRound(gameId, groupId, draft);

			expect(res.ok).toBe(true);
			expect(spyRoundValidate).toHaveBeenCalled();
			expect(spyRoundValidate).toHaveBeenCalledWith(
				expect.objectContaining({
					type: draft.type,
					eyesRe: draft.eyesRe,
					participants: expect.any(Array)
				}),
				true // withMandatorySolos from game
			);
			expect(spyGameValidate).toHaveBeenCalled();
			expect(spyGameValidate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: gameId,
					participants: expect.any(Array),
					rounds: expect.any(Array)
				})
			);

			spyRoundValidate.mockRestore();
			spyGameValidate.mockRestore();
		});

		it('creates a round and persists participants, calls, bonuses and results', async () => {
			// Exclude dealer (seat 0) for round 1
			const draft = makeNormalRoundDraft(playerIds[1], playerIds[2], playerIds[3], playerIds[4]);
			// add some bonuses in normal game
			draft.participants[0].bonuses.push({
				playerId: playerIds[1],
				bonusType: BonusType.Fuchs,
				count: 1
			});
			const res = await roundRepo.addRound(gameId, groupId, draft);
			expect(res.ok).toBe(true);
			if (res.ok) {
				const rid = res.value.id;
				const parts = await db
					.select()
					.from(GameRoundParticipantTable)
					.where(eq(GameRoundParticipantTable.roundId, rid));
				expect(parts.length).toBe(4);
				const calls = await db
					.select()
					.from(GameRoundCallTable)
					.where(eq(GameRoundCallTable.roundId, rid));
				expect(calls.length).toBe(2);
				const bonuses = await db
					.select()
					.from(GameRoundBonusTable)
					.where(eq(GameRoundBonusTable.roundId, rid));
				expect(bonuses.length).toBe(1);
				const results = await db
					.select()
					.from(GameRoundResultTable)
					.where(eq(GameRoundResultTable.roundId, rid));
				expect(results.length).toBe(4);
			}
		});

		it('respects max round count', async () => {
			// Use a separate game without mandatory solos to avoid parade constraints
			const g2 = await gameRepo.create(groupId, 10, false, playerIds);
			if (!g2.ok) throw new Error('Failed to create auxiliary game');
			const gameId2 = g2.value.id;

			// Create max rounds, excluding current dealer each round
			for (let i = 0; i < 10; i++) {
				const dealerIdx = i % 5;
				const players = playerIds.filter((_, idx) => idx !== dealerIdx);
				const base = makeNormalRoundDraft(players[0], players[1], players[2], players[3]);
				const res = await roundRepo.addRound(gameId2, groupId, base);
				if (!res.ok) throw new Error('failed to add round ' + (i + 1) + ': ' + res.error);
			}

			// One more should exceed the max round count
			const dealerIdx = 10 % 5;
			const players = playerIds.filter((_, idx) => idx !== dealerIdx);
			const extra = makeNormalRoundDraft(players[0], players[1], players[2], players[3]);
			const res = await roundRepo.addRound(gameId2, groupId, extra);
			expect(res).toEqual({ ok: false, error: 'Maximale Rundenzahl erreicht.', status: 400 });
		});
	});

	describe('getById', () => {
		it('forbids when round not in user group', async () => {
			// Exclude dealer (seat 0)
			const draft = makeNormalRoundDraft(playerIds[1], playerIds[2], playerIds[3], playerIds[4]);
			const created = await roundRepo.addRound(gameId, groupId, draft);
			if (!created.ok) throw new Error('failed to create round');

			const other = await playerRepo.create({
				displayName: 'Other',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRoundRepo = new RoundRepository(other.id);
			const res = await otherRoundRepo.getById(created.value.id, gameId, groupId);
			expect(res).toEqual({
				ok: false,
				error: 'Runde nicht gefunden oder keine Berechtigung.',
				status: 404
			});
		});

		it('404 when round not found', async () => {
			const res = await roundRepo.getById('00000000-0000-0000-0000-000000000000', gameId, groupId);
			expect(res).toEqual({
				ok: false,
				error: 'Runde nicht gefunden oder keine Berechtigung.',
				status: 404
			});
		});

		it('returns round with participants', async () => {
			const draft = makeNormalRoundDraft(playerIds[1], playerIds[2], playerIds[3], playerIds[4]);
			const created = await roundRepo.addRound(gameId, groupId, draft);
			if (!created.ok) throw new Error('failed to create round');
			const res = await roundRepo.getById(created.value.id, gameId, groupId);
			expect(res.ok).toBe(true);
			if (res.ok) {
				expect(res.value.participants).toHaveLength(4);
				expect(res.value.type).toBe(RoundType.Normal);
			}
		});
	});

	describe('updateRound', () => {
		it('prevents switching Pflicht/Lust on existing rounds', async () => {
			// create Pflichtsolo round
			const draft: RoundData = {
				id: 'draft',
				roundNumber: 1,
				type: RoundType.SoloHerz,
				soloType: SoloType.Pflicht,
				eyesRe: 121,
				participants: [
					{ playerId: playerIds[1], team: Team.RE, calls: [], bonuses: [] },
					{ playerId: playerIds[2], team: Team.KONTRA, calls: [], bonuses: [] },
					{ playerId: playerIds[3], team: Team.KONTRA, calls: [], bonuses: [] },
					{ playerId: playerIds[4], team: Team.KONTRA, calls: [], bonuses: [] }
				]
			};
			const created = await roundRepo.addRound(gameId, groupId, draft);
			if (!created.ok) throw new Error('create failed');

			// try to switch to Lust
			const update: RoundData = {
				...draft,
				id: created.value.id,
				roundNumber: 1,
				soloType: SoloType.Lust
			};
			const res = await roundRepo.updateRound(created.value.id, gameId, groupId, update);
			expect(res).toEqual({
				ok: false,
				error:
					'Für eine bestehende Runde kann nicht geändert werden, ob sie eine Pflicht- oder Lust-Solo-Runde ist.',
				status: 400
			});
		});

		it('calls Round.validate and Game.validate when updating', async () => {
			const draft = makeNormalRoundDraft(playerIds[1], playerIds[2], playerIds[3], playerIds[4]);
			const created = await roundRepo.addRound(gameId, groupId, draft);
			if (!created.ok) throw new Error('create failed');

			const spyRoundValidate = vi.spyOn(Round, 'validate');
			const spyGameValidate = vi.spyOn(Game, 'validate');

			// flip calls to favor KONTRA and lower eyesRe
			const updated: RoundData = {
				...draft,
				id: created.value.id,
				roundNumber: 1,
				eyesRe: 60,
				participants: [
					{ playerId: playerIds[1], team: Team.RE, calls: [], bonuses: [] },
					{ playerId: playerIds[3], team: Team.RE, calls: [], bonuses: [] },
					{
						playerId: playerIds[2],
						team: Team.KONTRA,
						calls: [
							{ playerId: playerIds[2], callType: CallType.KONTRA },
							{ playerId: playerIds[2], callType: CallType.Keine90 }
						],
						bonuses: []
					},
					{ playerId: playerIds[4], team: Team.KONTRA, calls: [], bonuses: [] }
				]
			};

			const res = await roundRepo.updateRound(created.value.id, gameId, groupId, updated);

			expect(res.ok).toBe(true);
			expect(spyRoundValidate).toHaveBeenCalled();
			expect(spyRoundValidate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: created.value.id,
					type: updated.type,
					eyesRe: updated.eyesRe,
					participants: expect.any(Array)
				}),
				true // withMandatorySolos from game
			);
			expect(spyGameValidate).toHaveBeenCalled();
			expect(spyGameValidate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: gameId,
					participants: expect.any(Array),
					rounds: expect.any(Array)
				})
			);

			spyRoundValidate.mockRestore();
			spyGameValidate.mockRestore();
		});

		it('updates successfully and recalculates results', async () => {
			const draft = makeNormalRoundDraft(playerIds[1], playerIds[2], playerIds[3], playerIds[4]);
			const created = await roundRepo.addRound(gameId, groupId, draft);
			if (!created.ok) throw new Error('create failed');

			// flip calls to favor KONTRA and lower eyesRe
			const updated: RoundData = {
				...draft,
				id: created.value.id,
				roundNumber: 1,
				eyesRe: 60,
				participants: [
					{ playerId: playerIds[1], team: Team.RE, calls: [], bonuses: [] },
					{ playerId: playerIds[3], team: Team.RE, calls: [], bonuses: [] },
					{
						playerId: playerIds[2],
						team: Team.KONTRA,
						calls: [
							{ playerId: playerIds[2], callType: CallType.KONTRA },
							{ playerId: playerIds[2], callType: CallType.Keine90 }
						],
						bonuses: []
					},
					{ playerId: playerIds[4], team: Team.KONTRA, calls: [], bonuses: [] }
				]
			};

			const res = await roundRepo.updateRound(created.value.id, gameId, groupId, updated);
			expect(res.ok).toBe(true);
			if (res.ok) {
				const rid = res.value.id;
				// 4 results should exist
				const results = await db
					.select()
					.from(GameRoundResultTable)
					.where(eq(GameRoundResultTable.roundId, rid));
				expect(results.length).toBe(4);
			}
		});
	});
});
