import { describe, it, expect } from 'vitest';
import { Game, type GameParticipant } from './game';
import { Player } from './player';
import { Round, type RoundData } from './round';
import { RoundType, Team, SoloType, BonusType, CallType, AuthProvider } from './enums';

const createPlayer = (id: string, displayName: string): Player => {
	return new Player({
		id,
		displayName,
		authProvider: AuthProvider.Local,
		authProviderId: null,
		createdAt: new Date()
	});
};

const createParticipant = (
	playerId: string,
	seatPosition: number,
	displayName?: string
): GameParticipant => ({
	playerId,
	seatPosition,
	player: displayName ? createPlayer(playerId, displayName) : undefined
});

const createRound = (roundNumber: number): RoundData => ({
	id: `round-${roundNumber}`,
	roundNumber,
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

const createMandatorySoloRound = (roundNumber: number, soloPlayerId: string): RoundData => {
	const data = createRound(roundNumber);
	data.type = RoundType.SoloHerz;
	data.soloType = SoloType.Pflicht;
	data.participants.forEach((p) => (p.team = Team.KONTRA));
	data.participants[0].playerId = soloPlayerId;
	data.participants[0].team = Team.RE;
	return data;
};

const createRoundWithoutDealer = (
	roundNumber: number,
	dealerId: string,
	soloPlayerId: string | null = null
): RoundData => {
	const players = ['p1', 'p2', 'p3', 'p4', 'p5'].filter((id) => id !== dealerId);
	const participants = players.map((playerId, idx) => ({
		playerId,
		team: idx < 2 ? Team.RE : Team.KONTRA,
		calls: [],
		bonuses: []
	}));

	if (soloPlayerId) {
		for (const participant of participants) participant.team = Team.KONTRA;
		const solo = participants.find((p) => p.playerId === soloPlayerId);
		if (solo) solo.team = Team.RE;
	}

	return {
		id: `round-${roundNumber}`,
		roundNumber,
		type: soloPlayerId ? RoundType.SoloHerz : RoundType.Normal,
		soloType: soloPlayerId ? SoloType.Pflicht : null,
		eyesRe: 121,
		participants
	};
};

const createValidGame = (
	playerCount: number = 4,
	maxRounds: number = 8,
	withMandatorySolos: boolean = false
): Game => {
	const participants: GameParticipant[] = [];
	for (let i = 0; i < playerCount; i++) {
		participants.push(createParticipant(`p${i + 1}`, i, `Player ${i + 1}`));
	}

	return new Game(
		{
			id: 'game-1',
			groupId: 'group-1',
			maxRoundCount: maxRounds,
			withMandatorySolos,
			createdAt: new Date(),
			endedAt: null
		},
		participants,
		[]
	);
};

describe('Game.validate', () => {
	describe('participant count validation', () => {
		it('rejects fewer than 4 participants', () => {
			const game = createValidGame(3);
			game.participants = game.participants.slice(0, 3);

			const error = Game.validate(game);
			expect(error).toBe('Es müssen genau 4 oder 5 Teilnehmer ausgewählt werden.');
		});

		it('rejects more than 5 participants', () => {
			const game = createValidGame(5);
			game.participants.push(createParticipant('p6', 5, 'Player 6'));

			const error = Game.validate(game);
			expect(error).toBe('Es müssen genau 4 oder 5 Teilnehmer ausgewählt werden.');
		});

		it('accepts exactly 4 participants', () => {
			const game = createValidGame(4);

			const error = Game.validate(game);
			expect(error).toBeNull();
		});

		it('accepts exactly 5 participants', () => {
			const game = createValidGame(5, 10); // 5 players need 10, 15, 20, 25, or 30 rounds

			const error = Game.validate(game);
			expect(error).toBeNull();
		});
	});

	describe('participant uniqueness validation', () => {
		it('rejects duplicate participants', () => {
			const game = createValidGame(4);
			game.participants[2] = createParticipant('p1', 2, 'Player 1'); // Duplicate p1

			const error = Game.validate(game);
			expect(error).toBe('Jeder Spieler darf nur einmal ausgewählt werden.');
		});

		it('accepts all unique participants', () => {
			const game = createValidGame(4);

			const error = Game.validate(game);
			expect(error).toBeNull();
		});
	});

	describe('max round count validation', () => {
		describe('4-player games', () => {
			it('accepts valid round counts: 8, 12, 16, 20, 24', () => {
				const validCounts = [8, 12, 16, 20, 24];
				for (const count of validCounts) {
					const game = createValidGame(4, count);
					const error = Game.validate(game);
					expect(error).toBeNull();
				}
			});

			it('rejects invalid round counts', () => {
				const game = createValidGame(4, 10); // Valid for 5 players, not 4

				const error = Game.validate(game);
				expect(error).toBe('Gültige Rundenanzahlen sind: 8, 12, 16, 20, 24.');
			});
		});

		describe('5-player games', () => {
			it('accepts valid round counts: 10, 15, 20, 25, 30', () => {
				const validCounts = [10, 15, 20, 25, 30];
				for (const count of validCounts) {
					const game = createValidGame(5, count);
					const error = Game.validate(game);
					expect(error).toBeNull();
				}
			});

			it('rejects invalid round counts', () => {
				const game = createValidGame(5, 8); // Valid for 4 players, not 5

				const error = Game.validate(game);
				expect(error).toBe('Gültige Rundenanzahlen sind: 10, 15, 20, 25, 30.');
			});
		});
	});

	describe('latest round participant validation', () => {
		it('validates latest round participants are game members', () => {
			const game = createValidGame(4, 8);
			const roundData = createRound(1);
			roundData.participants[0].playerId = 'p99'; // Non-existent player
			game.rounds.push(new Round(roundData));

			const error = Game.validate(game);
			expect(error).toBe('Teilnehmer stimmen nicht mit dem Spiel überein.');
		});

		it('accepts when all latest round participants are game members', () => {
			const game = createValidGame(4, 8);
			const roundData = createRound(1);
			game.rounds.push(new Round(roundData));

			const error = Game.validate(game);
			expect(error).toBeNull();
		});

		it('only checks latest round (not all rounds)', () => {
			const game = createValidGame(4, 8);
			// Add round with non-existent player (but not as latest)
			const roundData1 = createRound(1);
			roundData1.participants[0].playerId = 'p99';
			game.rounds.push(new Round(roundData1));

			// Add valid latest round
			const roundData2 = createRound(2);
			game.rounds.push(new Round(roundData2));

			const error = Game.validate(game);
			expect(error).toBeNull(); // Should pass because only latest round is checked
		});
	});

	describe('mandatory solo validation', () => {
		it('rejects Pflicht solo rounds when game does not have mandatory solos', () => {
			const game = createValidGame(4, 8, false); // withMandatorySolos = false
			const roundData = createRound(1);
			roundData.type = RoundType.SoloHerz;
			roundData.soloType = SoloType.Pflicht;
			roundData.participants[1].team = Team.KONTRA;
			roundData.participants[2].team = Team.KONTRA;
			roundData.participants[3].team = Team.KONTRA;
			game.rounds.push(new Round(roundData));

			const error = Game.validate(game);
			expect(error).toBe('Pflichtsolo-Runden sind nur bei Spielen mit Pflichtsolo erlaubt.');
		});

		it('accepts Pflicht solo rounds when game has mandatory solos', () => {
			const game = createValidGame(4, 8, true); // withMandatorySolos = true
			const roundData = createRound(1);
			roundData.type = RoundType.SoloHerz;
			roundData.soloType = SoloType.Pflicht;
			roundData.participants[1].team = Team.KONTRA;
			roundData.participants[2].team = Team.KONTRA;
			roundData.participants[3].team = Team.KONTRA;
			game.rounds.push(new Round(roundData));

			const error = Game.validate(game);
			expect(error).toBeNull();
		});

		it('rejects when a player plays multiple Pflicht solos', () => {
			const game = createValidGame(4, 12, true);
			// First Pflicht solo by p1
			const roundData1 = createRound(1);
			roundData1.type = RoundType.SoloHerz;
			roundData1.soloType = SoloType.Pflicht;
			roundData1.participants[1].team = Team.KONTRA;
			roundData1.participants[2].team = Team.KONTRA;
			roundData1.participants[3].team = Team.KONTRA;
			game.rounds.push(new Round(roundData1));

			// Second Pflicht solo by p1
			const roundData2 = createRound(2);
			roundData2.type = RoundType.SoloHerz;
			roundData2.soloType = SoloType.Pflicht;
			roundData2.participants[1].team = Team.KONTRA;
			roundData2.participants[2].team = Team.KONTRA;
			roundData2.participants[3].team = Team.KONTRA;
			game.rounds.push(new Round(roundData2));

			const error = Game.validate(game);
			expect(error).toContain('hat bereits ein Pflichtsolo gespielt');
		});

		it('accepts when different players play Pflicht solos', () => {
			const game = createValidGame(4, 12, true);
			// First Pflicht solo by p1
			const roundData1 = createRound(1);
			roundData1.type = RoundType.SoloHerz;
			roundData1.soloType = SoloType.Pflicht;
			roundData1.participants[1].team = Team.KONTRA;
			roundData1.participants[2].team = Team.KONTRA;
			roundData1.participants[3].team = Team.KONTRA;
			game.rounds.push(new Round(roundData1));

			// Second Pflicht solo by p2
			const roundData2 = createRound(2);
			roundData2.type = RoundType.SoloHerz;
			roundData2.soloType = SoloType.Pflicht;
			roundData2.participants[0].playerId = 'p2'; // p2 is solo player now
			roundData2.participants[1].playerId = 'p1';
			roundData2.participants[1].team = Team.KONTRA;
			roundData2.participants[2].team = Team.KONTRA;
			roundData2.participants[3].team = Team.KONTRA;
			game.rounds.push(new Round(roundData2));

			const error = Game.validate(game);
			expect(error).toBeNull();
		});

		it('rejects incomplete mandatory solo game when all players do not have Pflicht solos', () => {
			const game = createValidGame(4, 12, true);
			// Only 1 Pflicht solo played (p1), but game is not complete
			const roundData1 = createRound(1);
			roundData1.type = RoundType.SoloHerz;
			roundData1.soloType = SoloType.Pflicht;
			roundData1.participants[1].team = Team.KONTRA;
			roundData1.participants[2].team = Team.KONTRA;
			roundData1.participants[3].team = Team.KONTRA;
			game.rounds.push(new Round(roundData1));

			// Add 11 more normal rounds to complete the game
			for (let i = 2; i <= 12; i++) {
				const roundData = createRound(i);
				game.rounds.push(new Round(roundData));
			}

			const error = Game.validate(game);
			expect(error).toContain('muss noch ein Pflichtsolo spielen');
		});

		it('rejects when not enough remaining rounds for all players to play mandatory solos', () => {
			const game = createValidGame(4, 8, true);
			// Only 1 Pflicht solo played (p1), 6 normal rounds, but need 3 more solos for p2, p3, p4
			const roundData1 = createRound(1);
			roundData1.type = RoundType.SoloHerz;
			roundData1.soloType = SoloType.Pflicht;
			roundData1.participants[1].team = Team.KONTRA;
			roundData1.participants[2].team = Team.KONTRA;
			roundData1.participants[3].team = Team.KONTRA;
			game.rounds.push(new Round(roundData1));

			// Add 6 normal rounds
			for (let i = 2; i <= 7; i++) {
				const roundData = createRound(i);
				game.rounds.push(new Round(roundData));
			}

			const error = Game.validate(game);
			expect(error).toContain('müssen noch ihr Pflichtsolo spielen');
		});
	});

	describe('dealer position calculation', () => {
		it('rotates sequentially when mandatory solos are disabled', () => {
			const game = createValidGame(4, 8, false);
			const expected = [0, 1, 2, 3, 0, 1];
			expected.forEach((pos, idx) => {
				expect(game.getDealerPosition(idx + 1)).toBe(pos);
			});
		});

		it('does not advance dealer on mandatory solo rounds before parade', () => {
			const game = createValidGame(4, 8, true);
			// Round 1 normal, round 2 mandatory solo
			game.rounds.push(new Round(createRound(1)));
			game.rounds.push(new Round(createMandatorySoloRound(2, 'p1')));

			expect(game.getDealerPosition(1)).toBe(0);
			expect(game.getDealerPosition(2)).toBe(1);
			expect(game.getDealerPosition(3)).toBe(1); // mandatory solo did not advance dealer
		});

		it('rotates dealer during parade when only mandatory solos remain', () => {
			const game = createValidGame(4, 8, true);
			// Four normal rounds, then parade starts at round 5
			for (let i = 1; i <= 4; i++) game.rounds.push(new Round(createRound(i)));
			// Mandatory solos in parade for rounds 5-7
			for (let i = 5; i <= 7; i++) {
				game.rounds.push(new Round(createMandatorySoloRound(i, `p${i - 4}`)));
			}

			expect(game.getDealerPosition(5)).toBe(0);
			expect(game.getDealerPosition(6)).toBe(1);
			expect(game.getDealerPosition(7)).toBe(2);
			expect(game.getDealerPosition(8)).toBe(3);
		});

		it('shifts final-round dealer in 5-player games when candidate still owes a mandatory solo', () => {
			const game = createValidGame(5, 10, true);

			// Rounds 1-4: mandatory solos by p2, p3, p4, p5
			const soloists = ['p2', 'p3', 'p4', 'p5'];
			for (let idx = 0; idx < soloists.length; idx++) {
				const roundNumber = idx + 1;
				const dealerId = game.getDealerForRound(roundNumber)?.playerId ?? '';
				expect(dealerId).toBe('p1');
				game.rounds.push(new Round(createRoundWithoutDealer(roundNumber, dealerId, soloists[idx])));
				const error = Game.validate(game);
				expect(error).toBeNull();
			}

			// Rounds 5-9: normal rounds (5 rounds)
			for (let roundNumber = 5; roundNumber <= 9; roundNumber++) {
				const dealerId = game.getDealerForRound(roundNumber)?.playerId ?? '';
				game.rounds.push(new Round(createRoundWithoutDealer(roundNumber, dealerId)));
				const error = Game.validate(game);
				expect(error).toBeNull();
			}

			// Round 10: parade - p1 plays their mandatory solo
			const dealerId10 = game.getDealerForRound(10)?.playerId ?? '';

			// p1 should not be the dealer on round 10
			expect(dealerId10).toBe('p2');

			// p1 must play their mandatory solo
			game.rounds.push(new Round(createRoundWithoutDealer(10, dealerId10, 'p1')));

			const error = Game.validate(game);
			expect(error).toBeNull();
		});
	});

	describe('dealer constraint for 5-player games', () => {
		it('normally the dealer is not accepted as a participant', () => {
			const game = createValidGame(5, 10);
			const roundData = createRound(1);
			// For 5 players, dealer for round 1 is player at seat (1-1) % 5 = 0, which is p1
			// Verify p1 is in the round's participants
			expect(roundData.participants.some((p) => p.playerId === 'p1')).toBe(true);
			game.rounds.push(new Round(roundData));

			const error = Game.validate(game);
			expect(error).toContain('kann nicht an dieser Runde teilnehmen');
		});

		it('accepts when dealer does not participate in the latest round', () => {
			const game = createValidGame(5, 10);
			const roundData = createRound(1);
			// Remove the dealer (p1 at seat 0) from participants
			roundData.participants = roundData.participants.filter((p) => p.playerId !== 'p1');
			roundData.participants.push({ playerId: 'p5', team: Team.KONTRA, calls: [], bonuses: [] });
			game.rounds.push(new Round(roundData));

			const error = Game.validate(game);
			expect(error).toBeNull();
		});

		it('does not enforce dealer constraint for 4-player games', () => {
			const game = createValidGame(4, 8);
			const roundData = createRound(1);
			// In 4-player games, dealer validation should not apply
			game.rounds.push(new Round(roundData));

			const error = Game.validate(game);
			expect(error).toBeNull();
		});
	});

	describe('parade (Vorführung) validation', () => {
		it('requires Pflicht solo type during parade', () => {
			// Create a 4-player game with mandatory solos
			// With 4 players and 8 rounds: need 4 normal + 4 mandatory solos
			// Parade starts when remainingRounds === remainingMandatoryPlayers
			const game = createValidGame(4, 8, true);

			// Add 4 normal rounds
			for (let i = 1; i <= 4; i++) {
				const roundData = createRound(i);
				game.rounds.push(new Round(roundData));
			}

			// Add 3 mandatory solos (p1, p2, p3 have played)
			for (let i = 5; i <= 7; i++) {
				const roundData = createRound(i);
				roundData.type = RoundType.SoloHerz;
				roundData.soloType = SoloType.Pflicht;
				const playerIndex = i - 5; // 0, 1, 2
				roundData.participants[0].playerId = `p${playerIndex + 1}`;
				roundData.participants[1].team = Team.KONTRA;
				roundData.participants[2].team = Team.KONTRA;
				roundData.participants[3].team = Team.KONTRA;
				game.rounds.push(new Round(roundData));
			}

			// Round 8: try to add a normal round during parade (should fail)
			// The validation should require Pflicht solo during parade
			const invalidRound = createRound(8);
			invalidRound.type = RoundType.Normal;
			invalidRound.soloType = null;
			invalidRound.participants[0].playerId = 'p4'; // p4 participates in a normal round
			game.rounds.push(new Round(invalidRound));

			const error = Game.validate(game);
			expect(error).toBe('Player 4 muss noch ein Pflichtsolo spielen.');
		});

		it('accepts Pflicht solo during parade by correct player', () => {
			const game = createValidGame(4, 8, true);

			// Add 4 normal rounds
			for (let i = 1; i <= 4; i++) {
				const roundData = createRound(i);
				game.rounds.push(new Round(roundData));
			}

			// Add 3 mandatory solos (p1, p2, p3 have played)
			for (let i = 5; i <= 7; i++) {
				const roundData = createRound(i);
				roundData.type = RoundType.SoloHerz;
				roundData.soloType = SoloType.Pflicht;
				const playerIndex = i - 5; // 0, 1, 2
				roundData.participants[0].playerId = `p${playerIndex + 1}`;
				roundData.participants[1].team = Team.KONTRA;
				roundData.participants[2].team = Team.KONTRA;
				roundData.participants[3].team = Team.KONTRA;
				game.rounds.push(new Round(roundData));
			}

			// Round 8: p4 plays their Pflicht solo during parade
			const validRound = createRound(8);
			validRound.type = RoundType.SoloHerz;
			validRound.soloType = SoloType.Pflicht;
			validRound.participants[0].playerId = 'p4'; // p4 is the expected solo player
			validRound.participants[1].team = Team.KONTRA;
			validRound.participants[2].team = Team.KONTRA;
			validRound.participants[3].team = Team.KONTRA;
			game.rounds.push(new Round(validRound));

			const error = Game.validate(game);
			expect(error).toBeNull();
		});

		it('enforces correct order of players during parade', () => {
			const game = createValidGame(4, 8, true);

			// Add 4 normal rounds
			for (let i = 1; i <= 4; i++) {
				const roundData = createRound(i);
				game.rounds.push(new Round(roundData));
			}

			// Round 5: p4 tries to play (wrong order - p2 should play, since p1 is dealer)
			const wrongOrderRound = createRound(5);
			wrongOrderRound.type = RoundType.SoloHerz;
			wrongOrderRound.soloType = SoloType.Pflicht;
			wrongOrderRound.participants[0].playerId = 'p4'; // Wrong - p2 is expected
			wrongOrderRound.participants[3].playerId = 'p1'; // Wrong - p1 is expected
			wrongOrderRound.participants[1].team = Team.KONTRA;
			wrongOrderRound.participants[2].team = Team.KONTRA;
			wrongOrderRound.participants[3].team = Team.KONTRA;
			game.rounds.push(new Round(wrongOrderRound));

			const error = Game.validate(game);
			// The error should indicate that p3 must play their solo, not p4
			expect(error).toContain('Player 2 muss ein Pflichtsolo spielen');
		});

		it('accepts correct order of players during parade', () => {
			const game = createValidGame(4, 8, true);

			// Add 4 normal rounds
			for (let i = 1; i <= 4; i++) {
				const roundData = createRound(i);
				game.rounds.push(new Round(roundData));
			}

			// Add mandatory solos in correct order: p2, p3, p4, p1
			for (let i = 5; i <= 8; i++) {
				const roundData = createRound(i);
				roundData.type = RoundType.SoloHerz;
				roundData.soloType = SoloType.Pflicht;
				// 2, 3, 4, 1
				const playerIndex = (i - 4) % 4;
				roundData.participants[0].playerId = `p${playerIndex + 1}`;
				roundData.participants[1].team = Team.KONTRA;
				roundData.participants[2].team = Team.KONTRA;
				roundData.participants[3].team = Team.KONTRA;
				game.rounds.push(new Round(roundData));
				const error = Game.validate(game);
				expect(error).toBeNull();
			}
		});

		describe('5-player parade', () => {
			it('skips dealer when selecting the next mandatory soloist', () => {
				const game = createValidGame(5, 10, true);

				// Add 5 normal rounds with the dealer sitting out each time
				for (let roundNumber = 1; roundNumber <= 5; roundNumber++) {
					const dealerId = game.getDealerForRound(roundNumber)?.playerId ?? '';
					game.rounds.push(new Round(createRoundWithoutDealer(roundNumber, dealerId)));
				}

				// Parade starts at round 6; dealer is p1, expected soloist is p2, but p3 tries
				const dealerId = game.getDealerForRound(6)?.playerId ?? '';
				const paradeRound = createRoundWithoutDealer(6, dealerId, 'p3');
				game.rounds.push(new Round(paradeRound));

				const error = Game.validate(game);
				expect(error).toBe('Vorführung läuft, Player 2 muss ein Pflichtsolo spielen.');
			});

			it('accepts parade order with dealer sitting out each round', () => {
				const game = createValidGame(5, 10, true);

				// Normal rounds before parade
				for (let roundNumber = 1; roundNumber <= 5; roundNumber++) {
					const dealerId = game.getDealerForRound(roundNumber)?.playerId ?? '';
					game.rounds.push(new Round(createRoundWithoutDealer(roundNumber, dealerId)));
				}

				// Parade rounds: expected soloists skip the dealer each time
				const paradeSoloists = ['p2', 'p3', 'p4', 'p5', 'p1'];
				for (let idx = 0; idx < paradeSoloists.length; idx++) {
					const roundNumber = 6 + idx;
					const dealerId = game.getDealerForRound(roundNumber)?.playerId ?? '';
					const paradeRound = createRoundWithoutDealer(roundNumber, dealerId, paradeSoloists[idx]);
					game.rounds.push(new Round(paradeRound));

					const error = Game.validate(game);
					expect(error).toBeNull();
				}
			});
		});
	});

	describe('validation method instance', () => {
		it('instance validate method delegates to static method', () => {
			const game = createValidGame(4, 8);

			const result = game.validate();
			expect(result).toBeNull();
		});

		it('instance validate method returns same error as static method', () => {
			const game = createValidGame(3);
			game.participants = game.participants.slice(0, 3);

			const staticResult = Game.validate(game);
			const instanceResult = game.validate();

			expect(instanceResult).toBe(staticResult);
		});
	});

	describe('game completion check', () => {
		it('recognizes game is complete when round count equals max', () => {
			const game = createValidGame(4, 8);

			// Add 8 rounds
			for (let i = 1; i <= 8; i++) {
				game.rounds.push(new Round(createRound(i)));
			}

			expect(game.isComplete()).toBe(true);
		});

		it('recognizes game is incomplete when round count less than max', () => {
			const game = createValidGame(4, 8);

			// Add only 7 rounds
			for (let i = 1; i <= 7; i++) {
				game.rounds.push(new Round(createRound(i)));
			}

			expect(game.isComplete()).toBe(false);
		});
	});

	describe('game finished check', () => {
		it('recognizes game is finished when endedAt is set', () => {
			const game = createValidGame(4, 8);
			game.endedAt = new Date();

			expect(game.isFinished()).toBe(true);
		});

		it('recognizes game is not finished when endedAt is null', () => {
			const game = createValidGame(4, 8);
			game.endedAt = null;

			expect(game.isFinished()).toBe(false);
		});
	});
});
