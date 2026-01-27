import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Team, BonusType, CallType } from '$lib/domain/enums';
import { calculateGroupStatistics, getGroupStatistics } from './group';

describe('calculateGroupStatistics (group)', () => {
	it('aggregates across multiple games and normalizes by participation', () => {
		const games: any[] = [
			{
				id: 'g1',
				isFinished: () => true,
				participants: [
					{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
					{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
					{ player: { id: 'p3', getTruncatedDisplayName: () => 'Cara' } },
					{ player: { id: 'p4', getTruncatedDisplayName: () => 'Dave' } }
				],
				rounds: [
					{
						roundNumber: 1,
						participants: [
							{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [{ callType: CallType.RE }] },
							{
								playerId: 'p2',
								team: Team.KONTRA,
								bonuses: [{ bonusType: BonusType.Fuchs, count: 1 }],
								calls: []
							},
							{ playerId: 'p3', team: Team.RE, bonuses: [], calls: [] },
							{ playerId: 'p4', team: Team.KONTRA, bonuses: [], calls: [] }
						],
						eyesRe: 150,
						calculatePoints: () => [
							{ playerId: 'p1', points: 12 },
							{ playerId: 'p2', points: -12 },
							{ playerId: 'p3', points: 0 },
							{ playerId: 'p4', points: 0 }
						]
					}
				]
			},
			{
				id: 'g2',
				isFinished: () => true,
				participants: [
					{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
					{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
					{ player: { id: 'p3', getTruncatedDisplayName: () => 'Cara' } },
					{ player: { id: 'p4', getTruncatedDisplayName: () => 'Dave' } }
				],
				rounds: [
					{
						roundNumber: 1,
						participants: [
							{
								playerId: 'p1',
								team: Team.KONTRA,
								bonuses: [{ bonusType: BonusType.Karlchen, count: 1 }],
								calls: []
							},
							{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [{ callType: CallType.RE }] },
							{ playerId: 'p3', team: Team.RE, bonuses: [], calls: [] },
							{ playerId: 'p4', team: Team.KONTRA, bonuses: [], calls: [] }
						],
						eyesRe: 100,
						calculatePoints: () => [
							{ playerId: 'p1', points: -8 },
							{ playerId: 'p2', points: 8 },
							{ playerId: 'p3', points: 0 },
							{ playerId: 'p4', points: 0 }
						]
					}
				]
			}
		];

		const stats = calculateGroupStatistics(games as any);

		// players present
		const gamesPlayed = stats.gamesPlayed.map(({ player, games, color }) => ({
			player,
			games,
			color
		}));
		expect(gamesPlayed).toEqual([
			{ player: 'Alice', games: 2, color: expect.any(String) },
			{ player: 'Bob', games: 2, color: expect.any(String) },
			{ player: 'Cara', games: 2, color: expect.any(String) },
			{ player: 'Dave', games: 2, color: expect.any(String) }
		]);

		// calls aggregated
		expect(stats.callGrouped).toEqual([
			{
				player: 'Alice',
				RE: 1,
				KONTRA: 0,
				Keine90: 0,
				Keine60: 0,
				Keine30: 0,
				Schwarz: 0,
				color: expect.any(String)
			},
			{
				player: 'Bob',
				RE: 1,
				KONTRA: 0,
				Keine90: 0,
				Keine60: 0,
				Keine30: 0,
				Schwarz: 0,
				color: expect.any(String)
			},
			{
				player: 'Cara',
				RE: 0,
				KONTRA: 0,
				Keine90: 0,
				Keine60: 0,
				Keine30: 0,
				Schwarz: 0,
				color: expect.any(String)
			},
			{
				player: 'Dave',
				RE: 0,
				KONTRA: 0,
				Keine90: 0,
				Keine60: 0,
				Keine30: 0,
				Schwarz: 0,
				color: expect.any(String)
			}
		]);

		// bonuses aggregated
		expect(stats.bonusGrouped).toEqual([
			{ player: 'Alice', doko: 0, fuchs: 0, karlchen: 1, color: expect.any(String) },
			{ player: 'Bob', doko: 0, fuchs: 1, karlchen: 0, color: expect.any(String) },
			{ player: 'Cara', doko: 0, fuchs: 0, karlchen: 0, color: expect.any(String) },
			{ player: 'Dave', doko: 0, fuchs: 0, karlchen: 0, color: expect.any(String) }
		]);

		// avg points per game
		const atppg = stats.avgTotalPointsPerGame.reduce(
			(acc, v) => ({ ...acc, [v.player]: v.value }),
			{} as any
		);
		expect(atppg).toMatchObject({ Alice: 2, Bob: -2, Cara: 0, Dave: 0 }); // (12 - 8)/2, (-12+8)/2, (0)/2, (0)/2

		// rounds played aggregated across games
		const roundsPlayed = stats.roundsPlayed.reduce(
			(acc, v) => ({ ...acc, [v.player]: v.rounds }),
			{} as any
		);
		expect(roundsPlayed).toMatchObject({ Alice: 2, Bob: 2, Cara: 2, Dave: 2 });

		// rounds won aggregated across games (2 winning rounds: Alice in g1, Bob in g2)
		const roundsWon = stats.roundsWon.reduce(
			(acc, v) => ({ ...acc, [v.player]: { value: v.value, percent: v.percent } }),
			{} as any
		);
		expect(roundsWon['Alice']).toMatchObject({ value: 1, percent: 0.5 });
		expect(roundsWon['Bob']).toMatchObject({ value: 1, percent: 0.5 });
		expect(roundsWon['Cara']).toMatchObject({ value: 0, percent: 0 });
		expect(roundsWon['Dave']).toMatchObject({ value: 0, percent: 0 });

		// games won aggregation across games (Alice wins g1, Bob wins g2)
		const gamesWonAgg = stats.gamesWon.reduce(
			(acc, v) => ({ ...acc, [v.player]: { value: v.value, percent: v.percent } }),
			{} as any
		);
		expect(gamesWonAgg['Alice']).toMatchObject({ value: 1, percent: 0.5 });
		expect(gamesWonAgg['Bob']).toMatchObject({ value: 1, percent: 0.5 });
		expect(gamesWonAgg['Cara']).toMatchObject({ value: 0, percent: 0 });
		expect(gamesWonAgg['Dave']).toMatchObject({ value: 0, percent: 0 });

		// team win rates defined
		expect(stats.teamWinRates.find((x) => x.player === 'Alice')).toBeDefined();
	});
});

describe('getGroupStatistics (group)', () => {
	const { listByGroupMock, getByIdMock, gameRepoCtor } = vi.hoisted(() => {
		const listByGroupMock = vi.fn();
		const getByIdMock = vi.fn();
		const gameRepoCtor = vi.fn(function MockGameRepository(this: any) {
			this.listByGroup = listByGroupMock;
			this.getById = getByIdMock;
		});
		return { listByGroupMock, getByIdMock, gameRepoCtor };
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	vi.mock('$lib/server/repositories/game', () => ({
		GameRepository: gameRepoCtor
	}));

	it('returns empty stats when no games in group', async () => {
		listByGroupMock.mockResolvedValue({ ok: true, value: [] });
		const stats = await getGroupStatistics({ principalId: 'u', groupId: 'g' });
		expect(stats.gamesPlayed).toEqual([]);
		expect(stats.gamesCount).toBe(0);
	});

	it('returns empty stats when games have no rounds', async () => {
		listByGroupMock.mockResolvedValue({ ok: true, value: [{ id: 'g1' }, { id: 'g2' }] });
		getByIdMock.mockResolvedValue({
			ok: true,
			value: {
				id: 'g1',
				isFinished: () => true,
				participants: [
					{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
					{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
					{ player: { id: 'p3', getTruncatedDisplayName: () => 'Cara' } },
					{ player: { id: 'p4', getTruncatedDisplayName: () => 'Dave' } }
				],
				rounds: []
			}
		});
		const stats = await getGroupStatistics({ principalId: 'u', groupId: 'g' });
		expect(stats.gamesPlayed).toEqual([]);
		expect(stats.gamesCount).toBe(0);
	});

	it('returns aggregated statistics when games exist', async () => {
		listByGroupMock.mockResolvedValue({ ok: true, value: [{ id: 'g1' }, { id: 'g2' }] });
		const full1 = {
			id: 'g1',
			isFinished: () => true,
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
				{ player: { id: 'p3', getTruncatedDisplayName: () => 'Cara' } },
				{ player: { id: 'p4', getTruncatedDisplayName: () => 'Dave' } }
			],
			rounds: [
				{
					roundNumber: 1,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p3', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p4', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 150,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -5 },
						{ playerId: 'p3', points: -5 },
						{ playerId: 'p4', points: 0 }
					]
				}
			]
		};
		const full2 = {
			id: 'g2',
			isFinished: () => true,
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
				{ player: { id: 'p3', getTruncatedDisplayName: () => 'Cara' } },
				{ player: { id: 'p4', getTruncatedDisplayName: () => 'Dave' } }
			],
			rounds: [
				{
					roundNumber: 1,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p3', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p4', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: -4 },
						{ playerId: 'p2', points: 4 },
						{ playerId: 'p3', points: 0 },
						{ playerId: 'p4', points: 0 }
					]
				}
			]
		};
		getByIdMock.mockImplementation((id: string) => {
			return Promise.resolve({ ok: true, value: id === 'g1' ? full1 : full2 });
		});

		const stats = await getGroupStatistics({ principalId: 'u', groupId: 'g' });
		const gamesPlayed = stats.gamesPlayed.map(({ player, games, color }) => ({
			player,
			games,
			color
		}));
		expect(gamesPlayed).toEqual([
			{ player: 'Alice', games: 2, color: expect.any(String) },
			{ player: 'Bob', games: 2, color: expect.any(String) },
			{ player: 'Cara', games: 2, color: expect.any(String) },
			{ player: 'Dave', games: 2, color: expect.any(String) }
		]);
		const aliceAvg = stats.avgTotalPointsPerGame.find((v) => v.player === 'Alice');
		expect(aliceAvg?.value).toBe(3); // (10 - 4) / 2
	});
});
