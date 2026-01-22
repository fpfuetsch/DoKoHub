import { beforeEach, describe, expect, it } from 'vitest';
import { GameRepository } from './game';
import { PlayerRepository } from './player';
import { GroupRepository } from './group';
import { db } from '$lib/server/db';
import { GameTable, GroupTable, GroupMemberTable, PlayerTable } from '$lib/server/db/schema';
import { AuthProvider } from '$lib/server/enums';

describe('GameRepository', () => {
	let repository: GameRepository;
	let playerRepo: PlayerRepository;
	let groupRepo: GroupRepository;
	let testUserId: string;
	let testGroupId: string;
	let testPlayerIds: string[] = [];

	beforeEach(async () => {
		// Clean up tables
		await db.delete(GameTable);
		await db.delete(GroupMemberTable);
		await db.delete(GroupTable);
		await db.delete(PlayerTable);

		// Create test user/player
		playerRepo = new PlayerRepository();
		const testPlayer = await playerRepo.create({
			displayName: 'Test User',
			authProvider: AuthProvider.Local,
			authProviderId: null
		});
		testUserId = testPlayer.id;

		// Create test group
		groupRepo = new GroupRepository(testUserId);
		const groupResult = await groupRepo.create('Test Group');
		if (!groupResult.ok) throw new Error('Failed to create test group');
		testGroupId = groupResult.value.id;

		// Create test players for games
		testPlayerIds = [];
		for (let i = 0; i < 5; i++) {
			const player = await playerRepo.create({
				displayName: `Player ${i + 1}`,
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			testPlayerIds.push(player.id);
		}

		repository = new GameRepository(testUserId);
	});

	describe('getById', () => {
		it('returns forbidden when user is not group member', async () => {
			// Create another user not in the group
			const otherPlayer = await playerRepo.create({
				displayName: 'Other User',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRepo = new GameRepository(otherPlayer.id);

			// Create a game
			const gameResult = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			if (!gameResult.ok) throw new Error('Failed to create test game');

			const result = await otherRepo.getById(gameResult.value.id, testGroupId);

			expect(result).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('returns 404 when game not found', async () => {
			const result = await repository.getById('00000000-0000-0000-0000-000000000000', testGroupId);

			expect(result).toEqual({ ok: false, error: 'Spiel nicht gefunden.', status: 404 });
		});

		it('returns game successfully when found', async () => {
			const gameResult = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			if (!gameResult.ok) throw new Error('Failed to create test game');

			const result = await repository.getById(gameResult.value.id, testGroupId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.id).toBe(gameResult.value.id);
			}
		});

		it('returns game with participants and rounds', async () => {
			const gameResult = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			if (!gameResult.ok) throw new Error('Failed to create test game');

			const result = await repository.getById(gameResult.value.id, testGroupId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.participants).toHaveLength(4);
				expect(result.value.rounds).toEqual([]);
				expect(result.value.maxRoundCount).toBe(24);
				expect(result.value.withMandatorySolos).toBe(true);
			}
		});
	});

	describe('listByGroup', () => {
		it('returns forbidden when user is not group member', async () => {
			const otherPlayer = await playerRepo.create({
				displayName: 'Other User',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRepo = new GameRepository(otherPlayer.id);

			const result = await otherRepo.listByGroup(testGroupId);

			expect(result).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('returns empty list when no games exist', async () => {
			const result = await repository.listByGroup(testGroupId);

			expect(result).toEqual({ ok: true, value: [] });
		});

		it('returns list of games with participants', async () => {
			// Create two games
			await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			await repository.create(testGroupId, 30, false, testPlayerIds);

			const result = await repository.listByGroup(testGroupId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(2);
			}
		});

		it('orders games by creation date descending', async () => {
			const game1Result = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			if (!game1Result.ok) throw new Error('Failed to create game1');

			// Small delay to ensure different timestamps
			await new Promise((resolve) => setTimeout(resolve, 10));

			const game2Result = await repository.create(testGroupId, 30, false, testPlayerIds);
			if (!game2Result.ok) throw new Error('Failed to create game2');

			const result = await repository.listByGroup(testGroupId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(2);
				// Most recent first
				expect(result.value[0].id).toBe(game2Result.value.id);
				expect(result.value[1].id).toBe(game1Result.value.id);
			}
		});

		it('users can only see games from their own groups', async () => {
			// Create games in first user's group
			await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			await repository.create(testGroupId, 30, false, testPlayerIds);

			// Create second user with their own group
			const otherPlayer = await playerRepo.create({
				displayName: 'Other User',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherGroupRepo = new GroupRepository(otherPlayer.id);
			const otherGroupResult = await otherGroupRepo.create('Other Group');
			if (!otherGroupResult.ok) throw new Error('Failed to create other group');
			const otherGroupId = otherGroupResult.value.id;

			// Create other user's test players
			const otherPlayerIds: string[] = [];
			for (let i = 0; i < 4; i++) {
				const player = await playerRepo.create({
					displayName: `Other Player ${i + 1}`,
					authProvider: AuthProvider.Local,
					authProviderId: null
				});
				otherPlayerIds.push(player.id);
			}

			// Create games in second user's group
			const otherGameRepo = new GameRepository(otherPlayer.id);
			await otherGameRepo.create(otherGroupId, 24, true, otherPlayerIds);

			// First user should only see their own 2 games
			const firstUserGames = await repository.listByGroup(testGroupId);
			expect(firstUserGames.ok).toBe(true);
			if (firstUserGames.ok) {
				expect(firstUserGames.value).toHaveLength(2);
			}

			// Second user should only see their 1 game
			const secondUserGames = await otherGameRepo.listByGroup(otherGroupId);
			expect(secondUserGames.ok).toBe(true);
			if (secondUserGames.ok) {
				expect(secondUserGames.value).toHaveLength(1);
			}

			// First user should not be able to access second user's group
			const crossAccessResult = await repository.listByGroup(otherGroupId);
			expect(crossAccessResult).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});
	});

	describe('create', () => {
		it('returns forbidden when user is not group member', async () => {
			const otherPlayer = await playerRepo.create({
				displayName: 'Other User',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRepo = new GameRepository(otherPlayer.id);

			const result = await otherRepo.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));

			expect(result).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('returns validation error for invalid participant count', async () => {
			const result = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 2));

			expect(result.ok).toBe(false);
		});

		it('creates game successfully with 4 participants', async () => {
			const result = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.participants).toHaveLength(4);
			}
		});

		it('creates game successfully with 5 participants', async () => {
			const result = await repository.create(testGroupId, 30, false, testPlayerIds);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.participants).toHaveLength(5);
				expect(result.value.maxRoundCount).toBe(30);
				expect(result.value.withMandatorySolos).toBe(false);
			}
		});

		it('removes duplicate participant IDs', async () => {
			const duplicateIds = [
				testPlayerIds[0],
				testPlayerIds[0],
				testPlayerIds[1],
				testPlayerIds[2],
				testPlayerIds[3]
			];
			const result = await repository.create(testGroupId, 24, true, duplicateIds);

			// Should fail validation because draft game contains duplicates
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain('nur einmal');
			}
		});

		it('assigns correct seat positions', async () => {
			const result = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.participants[0].seatPosition).toBe(0);
				expect(result.value.participants[1].seatPosition).toBe(1);
				expect(result.value.participants[2].seatPosition).toBe(2);
				expect(result.value.participants[3].seatPosition).toBe(3);
			}
		});
	});

	describe('finish', () => {
		it('returns forbidden when user is not group member', async () => {
			const gameResult = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			if (!gameResult.ok) throw new Error('Failed to create test game');

			const otherPlayer = await playerRepo.create({
				displayName: 'Other User',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRepo = new GameRepository(otherPlayer.id);

			const result = await otherRepo.finish(gameResult.value.id, testGroupId, new Date());

			expect(result).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('returns error when game not found', async () => {
			const result = await repository.finish(
				'00000000-0000-0000-0000-000000000000',
				testGroupId,
				new Date()
			);

			expect(result).toEqual({ ok: false, error: 'Spiel nicht gefunden.', status: 404 });
		});

		it('returns error when game is already finished', async () => {
			const gameResult = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			if (!gameResult.ok) throw new Error('Failed to create test game');

			// Finish the game once
			const firstFinish = await repository.finish(gameResult.value.id, testGroupId, new Date());
			if (!firstFinish.ok) throw new Error('Failed to finish game');

			// Try to finish again
			const result = await repository.finish(gameResult.value.id, testGroupId, new Date());

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain('bereits beendet');
			}
		});

		it('finishes game successfully', async () => {
			const gameResult = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			if (!gameResult.ok) throw new Error('Failed to create test game');

			const endDate = new Date();
			const result = await repository.finish(gameResult.value.id, testGroupId, endDate);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.endedAt).not.toBeNull();
			}
		});

		it('persists finished state', async () => {
			const gameResult = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			if (!gameResult.ok) throw new Error('Failed to create test game');

			const endDate = new Date();
			await repository.finish(gameResult.value.id, testGroupId, endDate);

			// Fetch the game again
			const fetchResult = await repository.getById(gameResult.value.id, testGroupId);

			expect(fetchResult.ok).toBe(true);
			if (fetchResult.ok) {
				expect(fetchResult.value.endedAt).not.toBeNull();
				expect(fetchResult.value.isFinished()).toBe(true);
			}
		});
	});

	describe('delete', () => {
		it('returns forbidden when user is not group member', async () => {
			const gameResult = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			if (!gameResult.ok) throw new Error('Failed to create test game');

			const otherPlayer = await playerRepo.create({
				displayName: 'Other User',
				authProvider: AuthProvider.Local,
				authProviderId: null
			});
			const otherRepo = new GameRepository(otherPlayer.id);

			const result = await otherRepo.delete(gameResult.value.id, testGroupId);

			expect(result).toEqual({ ok: false, error: 'Forbidden', status: 403 });
		});

		it('returns error when game not found', async () => {
			const result = await repository.delete('00000000-0000-0000-0000-000000000000', testGroupId);

			expect(result).toEqual({
				ok: false,
				error: 'Spiel konnte nicht gelöscht werden.',
				status: 404
			});
		});

		it('deletes game successfully', async () => {
			const gameResult = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			if (!gameResult.ok) throw new Error('Failed to create test game');

			const result = await repository.delete(gameResult.value.id, testGroupId);

			expect(result).toEqual({ ok: true });
		});

		it('removes game from database', async () => {
			const gameResult = await repository.create(testGroupId, 24, true, testPlayerIds.slice(0, 4));
			if (!gameResult.ok) throw new Error('Failed to create test game');

			await repository.delete(gameResult.value.id, testGroupId);

			// Try to fetch deleted game
			const fetchResult = await repository.getById(gameResult.value.id, testGroupId);

			expect(fetchResult).toEqual({ ok: false, error: 'Spiel nicht gefunden.', status: 404 });
		});
	});
});
