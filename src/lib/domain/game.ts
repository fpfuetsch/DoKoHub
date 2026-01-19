import type { GameType } from '$lib/server/db/schema';
import { Player } from './player';
import { Round } from './round';
import { SoloType, Team as TeamEnum } from './enums';

export interface GameParticipant {
	playerId: string;
	player?: Player;
	seatPosition: number; // 0-3
}

export class Game implements GameType {
	id: string;
	groupId: string;
	maxRoundCount: number;
	withMandatorySolos: boolean;
	createdAt: Date;
	endedAt: Date | null;
	participants: GameParticipant[] = [];
	rounds: Round[] = [];

	constructor(data: GameType, participants: GameParticipant[] = [], rounds: Round[] = []) {
		this.id = data.id;
		this.groupId = data.groupId;
		this.maxRoundCount = data.maxRoundCount;
		this.withMandatorySolos = data.withMandatorySolos;
		this.createdAt = data.createdAt;
		this.endedAt = data.endedAt;
		this.participants = participants;
		this.rounds = rounds.sort((a, b) => a.roundNumber - b.roundNumber);
	}

	getRoundCount(): number {
		return this.rounds.length;
	}

	isFinished(): boolean {
		return this.endedAt !== null;
	}

	isComplete(): boolean {
		return this.rounds.length >= this.maxRoundCount;
	}

	/**
	 * Validate game-level constraints
	 * - If game has mandatory solos, every player must play exactly one Pflicht solo (only checked when game is complete)
	 * - Pflicht solo rounds are only allowed when game was created with withMandatorySolos
	 * - 4 or 5 participants must be provided (5th player is dealer who sits out)
	 * - maxRoundCount must be: 8, 12, 16, 20, 24 for 4 players; 10, 15, 20, 25, 30 for 5 players
	 * - All participants must be unique
	 */
	static validate(game: Game): string | null {
		// Validate participant count
		if (game.participants.length !== 4 && game.participants.length !== 5) {
			return 'Es müssen genau 4 oder 5 Teilnehmer ausgewählt werden.';
		}

		// Validate all participants are unique
		const uniquePlayerIds = new Set(game.participants.map((p) => p.playerId));
		if (uniquePlayerIds.size !== game.participants.length) {
			return 'Jeder Spieler darf nur einmal ausgewählt werden.';
		}

		// Validate maxRoundCount based on player count
		const validRoundCounts =
			game.participants.length === 4 ? [8, 12, 16, 20, 24] : [10, 15, 20, 25, 30];
		if (!validRoundCounts.includes(game.maxRoundCount)) {
			const validStr = validRoundCounts.join(', ');
			return `Gültige Rundenanzahlen sind: ${validStr}.`;
		}

		// Validate that Pflicht solo rounds only exist if game has mandatory solos
		const mandatorySoloRounds = game.rounds.filter((r) => r.soloType === SoloType.Pflicht);

		if (mandatorySoloRounds.length > 0 && !game.withMandatorySolos) {
			return 'Pflichtsolo-Runden sind nur bei Spielen mit Pflichtsolo erlaubt.';
		}

		// If game requires mandatory solos, validate constraints
		if (game.withMandatorySolos) {
			const playerMandatorySoloCounts = new Map<string, number>();

			// Initialize counts for all participants
			for (const participant of game.participants) {
				playerMandatorySoloCounts.set(participant.playerId, 0);
			}

			// Count Pflicht solos per player
			for (const round of mandatorySoloRounds) {
				const soloPlayer = round.participants.find((p) => p.team === TeamEnum.RE);
				if (soloPlayer) {
					const currentCount = playerMandatorySoloCounts.get(soloPlayer.playerId) ?? 0;
					playerMandatorySoloCounts.set(soloPlayer.playerId, currentCount + 1);
				}
			}

			// Always check for duplicates (player played more than one Pflicht solo)
			for (const [playerId, count] of playerMandatorySoloCounts.entries()) {
				if (count > 1) {
					const player = game.participants.find((p) => p.playerId === playerId);
					const playerName = player?.player?.displayName ?? 'Spieler';
					return `${playerName} hat bereits ein Pflichtsolo gespielt.`;
				}
			}

			// Only check for missing mandatory solos when game is complete
			if (game.isComplete()) {
				for (const [playerId, count] of playerMandatorySoloCounts.entries()) {
					if (count === 0) {
						const player = game.participants.find((p) => p.playerId === playerId);
						const playerName = player?.player?.displayName ?? 'Spieler';
						return `${playerName} muss sein Pflichtsolo spielen.`;
					}
				}
			} else {
				// If game is not complete, check if there are enough remaining rounds for all players to play their Pflicht solo
				const playersWithoutMandatorySolo = Array.from(playerMandatorySoloCounts.entries())
					.filter(([_, count]) => count === 0)
					.map(([playerId]) => playerId);

				const remainingRounds = game.maxRoundCount - game.rounds.length;

				if (playersWithoutMandatorySolo.length > remainingRounds) {
					return `${playersWithoutMandatorySolo.length} Spieler müssen noch ihr Pflichtsolo spielen. Keine Standard-Runden mehr verfügbar.`;
				}
			}
		}

		// Validate dealer constraint for 5-player games - check latest round
		if (game.participants.length === 5 && game.rounds.length > 0) {
			const latestRound = game.rounds[game.rounds.length - 1];
			const participantPlayerIds = new Set(latestRound.participants.map((p) => p.playerId));
			const dealer = game.getDealerForRound(latestRound.roundNumber);

			if (dealer && participantPlayerIds.has(dealer.playerId)) {
				return `Der Geber (${dealer.player?.displayName ?? 'Spieler'}) kann nicht an dieser Runde teilnehmen. Lade die Seite neu, um den Geber zu aktualisieren.`;
			}
		}

		// During parade (Vorführung), enforce that the correct player plays their Pflichtsolo
		if (game.withMandatorySolos && game.rounds.length > 0) {
			const latestRound = game.rounds[game.rounds.length - 1];
			if (game.isParadeActive(latestRound.roundNumber)) {
				const expectedSoloist = game.getExpectedMandatorySoloPlayer(latestRound.roundNumber);
				const soloPlayer = latestRound.participants.find((p) => p.team === TeamEnum.RE);

				if (latestRound.soloType !== SoloType.Pflicht) {
					return 'Während der Vorführung muss ein Pflichtsolo gespielt werden.';
				}

				if (expectedSoloist && (!soloPlayer || soloPlayer.playerId !== expectedSoloist.playerId)) {
					const name = expectedSoloist.player?.displayName ?? 'Spieler';
					return `Vorführung läuft: ${name} muss nun sein Pflichtsolo spielen.`;
				}
			}
		}

		return null;
	}

	/**
	 * Validate this game instance
	 */
	validate(): string | null {
		return Game.validate(this);
	}

	private countMandatorySolosBefore(roundNumber: number): number {
		return this.rounds.filter((r) => r.roundNumber < roundNumber && r.isMandatorySolo()).length;
	}

	private getMandatorySoloPlayersPlayedBefore(roundNumber: number): Set<string> {
		const players = new Set<string>();
		for (const round of this.rounds) {
			if (round.roundNumber >= roundNumber) break;
			if (round.isMandatorySolo()) {
				const soloPlayer = round.participants.find((p) => p.team === TeamEnum.RE);
				if (soloPlayer) players.add(soloPlayer.playerId);
			}
		}
		return players;
	}

	isParadeActive(roundNumber: number): boolean {
		if (!this.withMandatorySolos) return false;
		const remainingRounds = this.maxRoundCount - (roundNumber - 1);
		const remainingMandatory =
			this.participants.length - this.countMandatorySolosBefore(roundNumber);
		return remainingRounds === remainingMandatory;
	}

	private getParadeStartRound(): number | null {
		if (!this.withMandatorySolos) return null;
		const roundsSorted = [...this.rounds].sort((a, b) => a.roundNumber - b.roundNumber);
		let playedMandatory = 0;
		let idx = 0;
		for (let roundNumber = 1; roundNumber <= this.maxRoundCount; roundNumber++) {
			const remainingRounds = this.maxRoundCount - (roundNumber - 1);
			const remainingMandatory = this.participants.length - playedMandatory;
			if (remainingRounds === remainingMandatory) return roundNumber;
			if (idx < roundsSorted.length && roundsSorted[idx].roundNumber === roundNumber) {
				if (roundsSorted[idx].isMandatorySolo()) playedMandatory++;
				idx++;
			}
		}
		return null;
	}

	/**
	 * Determines the expected player for the next mandatory solo during parade (Vorführung)
	 * First one after the dealer who hasn't played their mandatory solo yet
	 */
	getExpectedMandatorySoloPlayer(roundNumber: number): GameParticipant | null {
		if (!this.isParadeActive(roundNumber)) return null;
		const dealer = this.getDealerForRound(roundNumber);
		const played = this.getMandatorySoloPlayersPlayedBefore(roundNumber);

		const sortedBySeat = [...this.participants].sort((a, b) => a.seatPosition - b.seatPosition);
		let ordered: GameParticipant[] = sortedBySeat;

		if (dealer) {
			const startIndex = sortedBySeat.findIndex((p) => p.playerId === dealer.playerId);
			if (startIndex !== -1) {
				ordered = [...sortedBySeat.slice(startIndex + 1), ...sortedBySeat.slice(0, startIndex)];
			}
			// Dealer cannot fulfill mandatory solo in parade
			ordered = ordered.filter((p) => p.playerId !== dealer.playerId);
		}

		const next = ordered.find((p) => !played.has(p.playerId));
		return next ?? null;
	}

	/**
	 * Calculates the dealer position for a given round number.
	 *
	 * For games WITHOUT mandatory solos:
	 * - Simple rotation: dealer = (roundNumber - 1) % playerCount
	 *
	 * For games WITH mandatory solos:
	 * - Mandatory solo rounds do NOT advance the dealer
	 * - Once all normal rounds are exhausted and only mandatory solos remain,
	 *   the dealer continues to rotate based on mandatory solo rounds
	 *
	 * @param roundNumber - The round number to calculate dealer for
	 * @returns The seat position (0-based index) of the dealer
	 */
	getDealerPosition(roundNumber: number): number {
		if (!this.withMandatorySolos) {
			// Simple rotation for games without mandatory solos
			return (roundNumber - 1) % this.participants.length;
		}

		// Count mandatory solos played before this round
		const playedMandatorySolos = this.countMandatorySolosBefore(roundNumber);

		// Calculate remaining games
		const unplayedRounds = this.maxRoundCount - (roundNumber - 1);
		const unplayedMandatorySolos = this.participants.length - playedMandatorySolos;

		if (!this.isParadeActive(roundNumber)) {
			// Normal rounds still exist - mandatory solos don't advance dealer
			return (roundNumber - playedMandatorySolos - 1) % this.participants.length;
		}

		// Only mandatory solos remain - find when this phase started
		const firstOnlyMandatoryRound = this.getParadeStartRound() ?? this.maxRoundCount + 1;

		// Calculate dealer position for "only mandatory" phase
		const mandatorySolosBeforePhase = this.countMandatorySolosBefore(firstOnlyMandatoryRound);

		let dealerPos =
			(firstOnlyMandatoryRound -
				mandatorySolosBeforePhase -
				1 +
				(roundNumber - firstOnlyMandatoryRound)) %
			this.participants.length;

		// In the very last round of a 5-player game, avoid assigning the dealer role
		// to someone who still owes their mandatory solo. Move to the next seat instead.
		if (
			this.participants.length === 5 &&
			roundNumber === this.maxRoundCount &&
			this.withMandatorySolos
		) {
			const dealerCandidate = this.participants[dealerPos];
			const played = this.getMandatorySoloPlayersPlayedBefore(roundNumber);
			if (dealerCandidate && !played.has(dealerCandidate.playerId)) {
				dealerPos = (dealerPos + 1) % this.participants.length;
			}
		}

		return dealerPos;
	}

	/**
	 * Gets the dealer participant for a given round number
	 * @param roundNumber - The round number
	 * @returns The GameParticipant who is the dealer, or null if not found
	 */
	getDealerForRound(roundNumber: number): GameParticipant | null {
		const dealerPos = this.getDealerPosition(roundNumber);
		return this.participants.find((p) => p.seatPosition === dealerPos) ?? null;
	}

	toJSON() {
		return {
			id: this.id,
			groupId: this.groupId,
			maxRoundCount: this.maxRoundCount,
			withMandatorySolos: this.withMandatorySolos,
			currentRoundCount: this.getRoundCount(),
			isComplete: this.isComplete(),
			createdAt: this.createdAt,
			endedAt: this.endedAt,
			participants: this.participants.map((p) => ({
				playerId: p.playerId,
				player: p.player ? p.player.toJSON() : null,
				seatPosition: p.seatPosition
			})),
			rounds: this.rounds.map((r) => r.toJSON())
		};
	}

	static fromJSON(json: any): Game {
		return new Game(
			{
				id: json.id,
				groupId: json.groupId,
				maxRoundCount: json.maxRoundCount,
				withMandatorySolos: json.withMandatorySolos,
				createdAt: new Date(json.createdAt),
				endedAt: json.endedAt ? new Date(json.endedAt) : null
			} as GameType,
			json.participants.map((p: any) => ({
				playerId: p.playerId,
				player: p.player ? Player.fromJSON(p.player) : undefined,
				seatPosition: p.seatPosition
			})),
			json.rounds.map((r: any) => Round.fromJSON(r))
		);
	}
}
