import { describe, it, expect } from 'vitest';
import { Round } from './round';
import { Team, CallType, BonusType, RoundType, RoundResult, SoloType } from '$lib/domain/enums';
import type { RoundData, GameRoundParticipant } from './round';

describe('Round.calculatePoints', () => {
	const createParticipant = (
		playerId: string,
		team: string,
		calls: Array<{ callType: string }> = [],
		bonuses: Array<{ bonusType: string; count: number }> = []
	): GameRoundParticipant => ({
		playerId,
		team: team as any,
		calls: calls.map((c) => ({ playerId, callType: c.callType as any })),
		bonuses: bonuses.map((b) => ({ playerId, bonusType: b.bonusType as any, count: b.count }))
	});

	const createRound = (
		participants: GameRoundParticipant[],
		eyesRe: number = 121,
		type: RoundType = RoundType.Normal
	): Round => {
		const roundData: RoundData = {
			id: '1',
			roundNumber: 1,
			type: type as any,
			soloType: null,
			eyesRe,
			participants
		};
		return new Round(roundData);
	};

	describe('basic win/loss scenarios', () => {
		it('should give RE positive points for winning without any calls', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				121
			); // RE wins with exactly 121 points

			const points = round.calculatePoints();
			const rePoints_1 = points[0].points;
			const rePoints_2 = points[1].points;
			const reResult_1 = points[0].result;
			const reResult_2 = points[1].result;
			const kontraPoints_1 = points[2].points;
			const kontraPoints_2 = points[3].points;
			const kontraResult_1 = points[2].result;
			const kontraResult_2 = points[3].result;

			expect(rePoints_1).toStrictEqual(1);
			expect(rePoints_2).toStrictEqual(1);
			expect(reResult_1).toBe(RoundResult.WON);
			expect(reResult_2).toBe(RoundResult.WON);
			expect(kontraPoints_1).toStrictEqual(-1);
			expect(kontraPoints_2).toStrictEqual(-1);
			expect(kontraResult_1).toBe(RoundResult.LOST);
			expect(kontraResult_2).toBe(RoundResult.LOST);
		});

		it('should give KONTRA bonus for winning against re', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				50
			); // KONTRA wins with 190 eyes

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;

			// should have: +1 win, +1 for gegen Re, +1 for <90, +1 for <60
			expect(rePoints).toStrictEqual(-4);
			expect(kontraPoints).toStrictEqual(4);
		});

		it('should not give RE bonus for winning against kontra', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				151
			); // RE: 151, KONTRA: 89

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;

			// Should have: +1 win, +1 for <90
			expect(rePoints).toStrictEqual(2);
			expect(kontraPoints).toStrictEqual(-2);
		});

		it('Kontra wins with 120 points', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				120
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const reResult = points[0].result;
			const kontraPoints = points[2].points;
			const kontraResult = points[2].result;

			// Should have: +1 win, +1 for against Re
			expect(reResult).toBe(RoundResult.LOST);
			expect(kontraResult).toBe(RoundResult.WON);
			expect(rePoints).toStrictEqual(-2);
			expect(kontraPoints).toStrictEqual(2);
		});

		it('Re wins with 121 points', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				121
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const reResult = points[0].result;
			const kontraPoints = points[2].points;
			const kontraResult = points[2].result;

			// Should have: +1 win
			expect(reResult).toBe(RoundResult.WON);
			expect(kontraResult).toBe(RoundResult.LOST);
			expect(rePoints).toStrictEqual(1);
			expect(kontraPoints).toStrictEqual(-1);
		});
	});

	describe('call points', () => {
		it('KONTRA calls requires 121 points if RE was not called', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA, [{ callType: CallType.KONTRA }]),
					createParticipant('p4', Team.KONTRA)
				],
				120
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const reResult = points[0].result;
			const kontraPoints = points[2].points;
			const kontraResult = points[2].result;

			expect(reResult).toBe(RoundResult.WON);
			expect(kontraResult).toBe(RoundResult.LOST);
			expect(rePoints).toStrictEqual(3);
			expect(kontraPoints).toStrictEqual(-3);
		});

		it('KONTRA call equires 120 points if RE also called', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [{ callType: CallType.RE }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA, [{ callType: CallType.KONTRA }]),
					createParticipant('p4', Team.KONTRA)
				],
				120
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const reResult = points[0].result;
			const kontraPoints = points[2].points;
			const kontraResult = points[2].result;

			expect(reResult).toBe(RoundResult.LOST);
			expect(kontraResult).toBe(RoundResult.WON);
			expect(rePoints).toStrictEqual(-6);
			expect(kontraPoints).toStrictEqual(6);
		});

		it('should award call points', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [{ callType: CallType.Keine90 }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				155
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;

			// Should have: +1 win, +2 for implict RE call, +1 for KEINE90 call, +1 for <90
			expect(rePoints).toStrictEqual(5);
			expect(kontraPoints).toStrictEqual(-5);
		});

		it('should award call points from both teams when somebody wins', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [{ callType: CallType.RE }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA, [{ callType: CallType.Keine60 }]),
					createParticipant('p4', Team.KONTRA)
				],
				121
			); // RE wins

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;

			// Should have: +1 win,
			// +2 for RE call,
			// +2 for implicit kontra, +1 for implicit keine90 call, +1 for keine60 call
			// +1 for 120 against keine 90
			// +1 for 90 against keine 60
			expect(rePoints).toStrictEqual(9);
			expect(kontraPoints).toStrictEqual(-9);
		});

		it('should not award call points when nobody wins (draw)', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [{ callType: CallType.Keine90 }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA, [{ callType: CallType.Keine90 }]),
					createParticipant('p4', Team.KONTRA)
				],
				120
			); // Exactly 120 - no one wins

			const points = round.calculatePoints();
			const reResult = points[0].result;
			const rePoints = points[0].points;
			const kontraResult = points[2].result;
			const kontraPoints = points[2].points;

			// should have 0 points for both teams
			expect(rePoints).toStrictEqual(0);
			expect(kontraPoints).toStrictEqual(0);
			expect(reResult).toBe(RoundResult.DRAW);
			expect(kontraResult).toBe(RoundResult.DRAW);
		});
	});

	describe('call points - absagen', () => {
		it('should count absagen (KEINE90) when somebody wins', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [{ callType: CallType.Keine90 }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				121
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;

			// kontra should get:
			// +1 win,
			// +1 against re, +2 for re call, +1 for KEINE90 call
			expect(rePoints).toStrictEqual(-5);
			expect(kontraPoints).toStrictEqual(5);
		});

		it('should count multiple absagen types', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [{ callType: CallType.Keine90 }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA, [{ callType: CallType.Keine60 }]),
					createParticipant('p4', Team.KONTRA)
				],
				121
			); // no body wins since both make absage calls

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;
			const reResult = points[0].result;
			const kontraResult = points[2].result;

			expect(reResult).toBe(RoundResult.DRAW);
			expect(kontraResult).toBe(RoundResult.DRAW);
			// re should get +1 for 120 eyes against keine90 and +1 for 90 eyes against keine60
			expect(rePoints).toStrictEqual(2);
			expect(kontraPoints).toStrictEqual(-2);
		});

		it('should count SCHWARZ absagen', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [{ callType: CallType.Schwarz }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				121
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;
			const reResult = points[0].result;
			const kontraResult = points[2].result;

			expect(reResult).toBe(RoundResult.LOST);
			expect(kontraResult).toBe(RoundResult.WON);
			// kontra should get:
			// +1 win,
			// +1 against re, +2 for re call, +4 for schwarz call
			// +1 for >90, >60, >30 against schwarz
			expect(rePoints).toStrictEqual(-11);
			expect(kontraPoints).toStrictEqual(11);
		});

		it('should calculate calls correctly in solo rounds', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [{ callType: CallType.Keine90 }]),
					createParticipant('p2', Team.KONTRA),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				155,
				RoundType.SoloDamen
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[1].points;
			const reResult = points[0].result;

			// RE should get: +1 win, +2 for RE call, +1 for KEINE90 call, +1 for <90
			expect(reResult).toBe(RoundResult.WON);
			expect(rePoints).toStrictEqual(15);
			expect(kontraPoints).toStrictEqual(-5);
		});
	});

	describe('threshold calculation with calls', () => {
		it('Re "Ansage" does not matter if Kontra gave "Absage', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [{ callType: CallType.RE }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA, [{ callType: CallType.Keine90 }])
				],
				90
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;
			const reResult = points[0].result;
			const kontraResult = points[2].result;

			// RE should get: +1 win, +2 for RE call, +2 for implicit Kontra, +1 for keine90 call
			expect(reResult).toBe(RoundResult.WON);
			expect(kontraResult).toBe(RoundResult.LOST);
			expect(rePoints).toStrictEqual(6);
			expect(kontraPoints).toStrictEqual(-6);
		});

		it('Kontra "Ansage" does not matter if Re gave "Absage', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [{ callType: CallType.Keine60 }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA, [{ callType: CallType.KONTRA }])
				],
				175
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;
			const reResult = points[0].result;
			const kontraResult = points[2].result;

			// Kontra should get: +1 win, +1 againste Re,
			// +2 for Kontra call, +2 for implicit Re,
			// +1 for implicit keine90 call, +1 for keine60 call,
			// -1 for > 90 points
			expect(reResult).toBe(RoundResult.LOST);
			expect(kontraResult).toBe(RoundResult.WON);
			expect(rePoints).toStrictEqual(-7);
			expect(kontraPoints).toStrictEqual(7);
		});
	});

	describe('bonus points', () => {
		it('should apply Kreuz damen bonus when KONTRA wins', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				30
			); // KONTRA wins with 210 eyes

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;
			const kontraResult = points[2].result;

			// KONTRA should get: +1 win, +1 Kreuz damen, +1 for <90, +1 for <60,
			expect(kontraResult).toBe(RoundResult.WON);
			expect(kontraPoints).toStrictEqual(4);
			expect(rePoints).toStrictEqual(-4);
		});

		it('should not apply Kreuz damen when RE wins', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				210
			); // RE wins with 210 eyes

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;
			const reResult = points[0].result;

			// RE should get: +1 win, +1 for >90, +1 for >60
			expect(reResult).toBe(RoundResult.WON);
			expect(rePoints).toStrictEqual(3);
			expect(kontraPoints).toStrictEqual(-3);
		});
		it('should award Doko bonus in normal rounds', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [], [{ bonusType: BonusType.Doko, count: 1 }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				121,
				RoundType.Normal
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;
			const reResult = points[0].result;

			// RE should get: +1 win, +1 Doko bonus
			expect(reResult).toBe(RoundResult.WON);
			expect(rePoints).toStrictEqual(2);
			expect(kontraPoints).toStrictEqual(-2);
		});

		it('should not award bonuses in solo rounds', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [], [{ bonusType: BonusType.Doko, count: 2 }]),
					createParticipant('p2', Team.KONTRA, [], [{ bonusType: BonusType.Fuchs, count: 2 }]),
					createParticipant('p3', Team.KONTRA, [], [{ bonusType: BonusType.Doko, count: 1 }]),
					createParticipant('p4', Team.KONTRA, [], [{ bonusType: BonusType.Karlchen, count: 1 }])
				],
				110,
				RoundType.SoloDamen
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const reResult = points[0].result;
			const kontraPoints_1 = points[1].points;
			const kontraResult_1 = points[1].result;
			const kontraPoints_2 = points[2].points;
			const kontraResult_2 = points[2].result;
			const kontraPoints_3 = points[2].points;
			const kontraResult_3 = points[2].result;

			// Kontra should get: +1 win only (no bonus in solo round)
			expect(rePoints).toStrictEqual(-3);
			expect(kontraPoints_1).toStrictEqual(1);
			expect(kontraPoints_2).toStrictEqual(1);
			expect(kontraPoints_3).toStrictEqual(1);
			expect(reResult).toBe(RoundResult.LOST);
			expect(kontraResult_1).toBe(RoundResult.WON);
			expect(kontraResult_2).toBe(RoundResult.WON);
			expect(kontraResult_3).toBe(RoundResult.WON);
		});

		it('should not award bonuses in stille hochzeit rounds', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [], [{ bonusType: BonusType.Doko, count: 2 }]),
					createParticipant('p2', Team.KONTRA, [], [{ bonusType: BonusType.Fuchs, count: 2 }]),
					createParticipant('p3', Team.KONTRA, [], [{ bonusType: BonusType.Doko, count: 1 }]),
					createParticipant('p4', Team.KONTRA, [], [{ bonusType: BonusType.Karlchen, count: 1 }])
				],
				121,
				RoundType.HochzeitStill
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const reResult = points[0].result;
			const kontraPoints = points[1].points;
			const kontraResult = points[1].result;

			// RE should get: +1 win only (no bonus in solo round)
			expect(rePoints).toStrictEqual(3);
			expect(kontraPoints).toStrictEqual(-1);
			expect(reResult).toBe(RoundResult.WON);
			expect(kontraResult).toBe(RoundResult.LOST);
		});

		it('should not award bonuses in ungeklaerte hochzeit rounds', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [], [{ bonusType: BonusType.Doko, count: 2 }]),
					createParticipant('p2', Team.KONTRA, [], [{ bonusType: BonusType.Fuchs, count: 2 }]),
					createParticipant('p3', Team.KONTRA, [], [{ bonusType: BonusType.Doko, count: 1 }]),
					createParticipant('p4', Team.KONTRA, [], [{ bonusType: BonusType.Karlchen, count: 1 }])
				],
				121,
				RoundType.HochzeitUngeklaert
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const reResult = points[0].result;
			const kontraPoints = points[1].points;
			const kontraResult = points[1].result;

			// RE should get: +1 win only (no bonus in solo round)
			expect(rePoints).toStrictEqual(3);
			expect(kontraPoints).toStrictEqual(-1);
			expect(reResult).toBe(RoundResult.WON);
			expect(kontraResult).toBe(RoundResult.LOST);
		});

		it('should award multiple bonuses', () => {
			const round = createRound(
				[
					createParticipant(
						'p1',
						Team.RE,
						[],
						[
							{ bonusType: BonusType.Doko, count: 2 },
							{ bonusType: BonusType.Fuchs, count: 1 }
						]
					),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA, [], [{ bonusType: BonusType.Karlchen, count: 1 }])
				],
				121,
				RoundType.Normal
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;

			// RE should get: +1 win, +2 Doko, +1 Fuchs, -1 Karlchen
			expect(rePoints).toStrictEqual(3);
			expect(kontraPoints).toStrictEqual(-3);
		});

		it('should award bonuses in Hochzeit Normal', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [], [{ bonusType: BonusType.Fuchs, count: 1 }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				121,
				RoundType.HochzeitNormal
			);

			const points = round.calculatePoints();
			const rePoints = points[0].points;
			const kontraPoints = points[2].points;

			// RE should get: +1 win, +1 Fuchs bonus
			expect(rePoints).toStrictEqual(2);
			expect(kontraPoints).toStrictEqual(-2);
		});
	});

	describe('mixed cases', () => {
		it('should manage complex draw', () => {
			const round = createRound(
				[
					createParticipant(
						'p1',
						Team.RE,
						[{ callType: CallType.Keine30 }],
						[{ bonusType: BonusType.Doko, count: 1 }]
					),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA, [{ callType: CallType.Keine90 }]),
					createParticipant('p4', Team.KONTRA, [], [{ bonusType: BonusType.Fuchs, count: 1 }])
				],
				170
			);

			const points = round.calculatePoints();
			const reResult = points[0].result;
			const rePoints = points[0].points;
			const kontraResult = points[2].result;
			const kontraPoints = points[2].points;

			// should have 0 points for both teams
			expect(rePoints).toStrictEqual(1);
			expect(kontraPoints).toStrictEqual(-1);
			expect(reResult).toBe(RoundResult.DRAW);
			expect(kontraResult).toBe(RoundResult.DRAW);
		});
	});

	describe('calculatePointsExplanation', () => {
		it('matches final points from calculatePoints in a normal round', () => {
			const round = createRound(
				[
					createParticipant('p1', Team.RE, [{ callType: CallType.Keine90 }]),
					createParticipant('p2', Team.RE),
					createParticipant('p3', Team.KONTRA),
					createParticipant('p4', Team.KONTRA)
				],
				151
			);

			const explanation = round.calculatePointsExplanation();
			const points = round.calculatePoints();

			expect(explanation.re.totalPoints).toStrictEqual(points[0].points);
			expect(explanation.kontra.totalPoints).toStrictEqual(points[2].points);
			expect(explanation.soloRePoints).toStrictEqual(explanation.re.totalPoints);
			expect(explanation.isSolo).toBe(false);
		});

		it('applies solo multiplier only to RE in solo rounds', () => {
			const roundData: RoundData = {
				id: 'solo-1',
				roundNumber: 1,
				type: RoundType.SoloBuben,
				soloType: SoloType.Lust,
				eyesRe: 121,
				participants: [
					{ playerId: 'p1', team: Team.RE, calls: [], bonuses: [] },
					{ playerId: 'p2', team: Team.KONTRA, calls: [], bonuses: [] },
					{ playerId: 'p3', team: Team.KONTRA, calls: [], bonuses: [] },
					{ playerId: 'p4', team: Team.KONTRA, calls: [], bonuses: [] }
				]
			};

			const round = new Round(roundData);
			const explanation = round.calculatePointsExplanation();
			const points = round.calculatePoints();

			expect(explanation.isSolo).toBe(true);
			expect(explanation.soloRePoints).toStrictEqual(explanation.re.totalPoints * 3);
			expect(points.find((p) => p.playerId === 'p1')?.points).toStrictEqual(
				explanation.soloRePoints
			);
			expect(points.find((p) => p.playerId === 'p2')?.points).toStrictEqual(
				explanation.kontra.totalPoints
			);
		});
	});
});

describe('Round.validate', () => {
	const createValidRoundData = (): RoundData => ({
		id: 'round-1',
		roundNumber: 1,
		type: RoundType.Normal,
		soloType: null,
		eyesRe: 121,
		participants: [
			{ playerId: 'p1', team: Team.RE, calls: [], bonuses: [] },
			{ playerId: 'p2', team: Team.RE, calls: [], bonuses: [] },
			{ playerId: 'p3', team: Team.KONTRA, calls: [], bonuses: [] },
			{ playerId: 'p4', team: Team.KONTRA, calls: [], bonuses: [] }
		]
	});

	describe('participant count validation', () => {
		it('validates exactly 4 participants are required', () => {
			const round = createValidRoundData();
			round.participants = round.participants.slice(0, 3);

			const error = Round.validate(round);
			expect(error).toBe('Es müssen genau 4 Teilnehmer gesetzt sein.');
		});

		it('rejects more than 4 participants', () => {
			const round = createValidRoundData();
			round.participants.push({ playerId: 'p5', team: Team.RE, calls: [], bonuses: [] });

			const error = Round.validate(round);
			expect(error).toBe('Es müssen genau 4 Teilnehmer gesetzt sein.');
		});

		it('accepts exactly 4 participants', () => {
			const round = createValidRoundData();

			const error = Round.validate(round);
			expect(error).toBeNull();
		});
	});

	describe('team assignment validation', () => {
		it('requires all participants to have a team', () => {
			const round = createValidRoundData();
			round.participants[0].team = null as any;

			const error = Round.validate(round);
			expect(error).toBe('Alle Spieler müssen einem Team zugeordnet werden.');
		});

		it('requires exactly 2 RE and 2 KONTRA for normal rounds', () => {
			const round = createValidRoundData();
			round.participants[0].team = Team.KONTRA; // Now 3 KONTRA, 1 RE

			const error = Round.validate(round);
			expect(error).toBe('Es müssen genau 2 Spieler im Re-Team sein.');
		});

		it('requires exactly 1 RE and 3 KONTRA for solo rounds', () => {
			const round = createValidRoundData();
			round.type = RoundType.SoloHerz;
			// Keep 2 RE, 2 KONTRA - should fail validation

			const error = Round.validate(round);
			expect(error).toBe('Es muss genau 1 Spieler im Re-Team sein.');
		});

		it('accepts 1 RE and 3 KONTRA for solo rounds', () => {
			const round = createValidRoundData();
			round.type = RoundType.SoloHerz;
			round.participants[1].team = Team.KONTRA;
			round.participants[2].team = Team.KONTRA;
			round.participants[3].team = Team.KONTRA;

			const error = Round.validate(round);
			expect(error).toBeNull();
		});
	});

	describe('eyes validation', () => {
		it('rejects negative eyes', () => {
			const round = createValidRoundData();
			round.eyesRe = -10;

			const error = Round.validate(round);
			expect(error).toBe('Augensumme muss >= 0 und <= 240 sein.');
		});

		it('rejects eyes over 240', () => {
			const round = createValidRoundData();
			round.eyesRe = 250;

			const error = Round.validate(round);
			expect(error).toBe('Augensumme muss >= 0 und <= 240 sein.');
		});

		it('accepts 0 eyes', () => {
			const round = createValidRoundData();
			round.eyesRe = 0;

			const error = Round.validate(round);
			expect(error).toBeNull();
		});

		it('accepts 240 eyes', () => {
			const round = createValidRoundData();
			round.eyesRe = 240;

			const error = Round.validate(round);
			expect(error).toBeNull();
		});
	});

	describe('bonus validation', () => {
		it('rejects bonuses in solo rounds', () => {
			const round = createValidRoundData();
			round.type = RoundType.SoloHerz;
			round.participants[0].team = Team.RE;
			round.participants[1].team = Team.KONTRA;
			round.participants[2].team = Team.KONTRA;
			round.participants[3].team = Team.KONTRA;
			round.participants[0].bonuses = [{ playerId: 'p1', bonusType: BonusType.Fuchs, count: 1 }];

			const error = Round.validate(round);
			expect(error).toBe(
				'Bonuspunkte werden nur in Normalspielen oder normaler Hochzeit gewertet.'
			);
		});

		it('accepts bonuses in normal rounds', () => {
			const round = createValidRoundData();
			round.participants[0].bonuses = [{ playerId: 'p1', bonusType: BonusType.Fuchs, count: 1 }];

			const error = Round.validate(round);
			expect(error).toBeNull();
		});

		it('accepts bonuses in Hochzeit Normal', () => {
			const round = createValidRoundData();
			round.type = RoundType.HochzeitNormal;
			round.participants[0].bonuses = [{ playerId: 'p1', bonusType: BonusType.Doko, count: 1 }];

			const error = Round.validate(round);
			expect(error).toBeNull();
		});

		it('rejects more than 2 Fuchs', () => {
			const round = createValidRoundData();
			round.participants[0].bonuses = [{ playerId: 'p1', bonusType: BonusType.Fuchs, count: 3 }];

			const error = Round.validate(round);
			expect(error).toBe('Es können max. 2 Füchse gefangen werden.');
		});

		it('rejects more than 1 Karlchen', () => {
			const round = createValidRoundData();
			round.participants[0].bonuses = [{ playerId: 'p1', bonusType: BonusType.Karlchen, count: 2 }];

			const error = Round.validate(round);
			expect(error).toBe('Es kann max. 1 Karlchen geben.');
		});

		it('rejects more than 5 Doppelköpfe', () => {
			const round = createValidRoundData();
			round.participants[0].bonuses = [{ playerId: 'p1', bonusType: BonusType.Doko, count: 6 }];

			const error = Round.validate(round);
			expect(error).toBe('Es können max. 5 Doppelköpfe vergeben werden.');
		});

		it('validates aggregate bonuses across all participants', () => {
			const round = createValidRoundData();
			round.participants[0].bonuses = [{ playerId: 'p1', bonusType: BonusType.Fuchs, count: 1 }];
			round.participants[2].bonuses = [{ playerId: 'p3', bonusType: BonusType.Fuchs, count: 2 }];

			const error = Round.validate(round);
			expect(error).toBe('Es können max. 2 Füchse gefangen werden.');
		});
	});

	describe('call validation', () => {
		it('requires RE calls to come from RE team', () => {
			const round = createValidRoundData();
			round.participants[2].calls = [{ playerId: 'p3', callType: CallType.RE }]; // p3 is KONTRA

			const error = Round.validate(round);
			expect(error).toBe('Re-Ansage muss vom Re-Team kommen.');
		});

		it('requires KONTRA calls to come from KONTRA team', () => {
			const round = createValidRoundData();
			round.participants[0].calls = [{ playerId: 'p1', callType: CallType.KONTRA }]; // p1 is RE

			const error = Round.validate(round);
			expect(error).toBe('Kontra-Ansage muss vom Kontra-Team kommen.');
		});

		it('accepts RE call from RE team', () => {
			const round = createValidRoundData();
			round.participants[0].calls = [{ playerId: 'p1', callType: CallType.RE }];

			const error = Round.validate(round);
			expect(error).toBeNull();
		});

		it('accepts KONTRA call from KONTRA team', () => {
			const round = createValidRoundData();
			round.participants[2].calls = [{ playerId: 'p3', callType: CallType.KONTRA }];

			const error = Round.validate(round);
			expect(error).toBeNull();
		});
	});

	describe('solo type validation', () => {
		it('rejects Lust solo without mandatory solos enabled', () => {
			const round = createValidRoundData();
			round.type = RoundType.SoloHerz;
			round.soloType = SoloType.Lust;
			round.participants[1].team = Team.KONTRA;
			round.participants[2].team = Team.KONTRA;
			round.participants[3].team = Team.KONTRA;

			const error = Round.validate(round, false);
			expect(error).toBe(
				'Solotyp (Lust- oder Pflichtsolo) ist nur bei Spielen mit Pflichtsolo erlaubt.'
			);
		});

		it('rejects Pflicht solo without mandatory solos enabled', () => {
			const round = createValidRoundData();
			round.type = RoundType.SoloHerz;
			round.soloType = SoloType.Pflicht;
			round.participants[1].team = Team.KONTRA;
			round.participants[2].team = Team.KONTRA;
			round.participants[3].team = Team.KONTRA;

			const error = Round.validate(round, false);
			expect(error).toBe(
				'Solotyp (Lust- oder Pflichtsolo) ist nur bei Spielen mit Pflichtsolo erlaubt.'
			);
		});

		it('accepts Pflicht solo when mandatory solos are enabled', () => {
			const round = createValidRoundData();
			round.type = RoundType.SoloHerz;
			round.soloType = SoloType.Pflicht;
			round.participants[1].team = Team.KONTRA;
			round.participants[2].team = Team.KONTRA;
			round.participants[3].team = Team.KONTRA;

			const error = Round.validate(round, true);
			expect(error).toBeNull();
		});

		it('accepts Lust solo when mandatory solos are enabled', () => {
			const round = createValidRoundData();
			round.type = RoundType.SoloHerz;
			round.soloType = SoloType.Lust;
			round.participants[1].team = Team.KONTRA;
			round.participants[2].team = Team.KONTRA;
			round.participants[3].team = Team.KONTRA;

			const error = Round.validate(round, true);
			expect(error).toBeNull();
		});
	});

	describe('Hochzeit variations', () => {
		it('requires 1 RE and 3 KONTRA for HochzeitStill', () => {
			const round = createValidRoundData();
			round.type = RoundType.HochzeitStill;
			// Keep 2 RE, 2 KONTRA

			const error = Round.validate(round);
			expect(error).toBe('Es muss genau 1 Spieler im Re-Team sein.');
		});

		it('accepts 1 RE and 3 KONTRA for HochzeitStill', () => {
			const round = createValidRoundData();
			round.type = RoundType.HochzeitStill;
			round.participants[1].team = Team.KONTRA;
			round.participants[2].team = Team.KONTRA;
			round.participants[3].team = Team.KONTRA;

			const error = Round.validate(round);
			expect(error).toBeNull();
		});

		it('requires 1 RE and 3 KONTRA for HochzeitUngeklaert', () => {
			const round = createValidRoundData();
			round.type = RoundType.HochzeitUngeklaert;

			const error = Round.validate(round);
			expect(error).toBe('Es muss genau 1 Spieler im Re-Team sein.');
		});
	});
});
