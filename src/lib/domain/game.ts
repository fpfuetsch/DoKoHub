import type { GameType } from '$lib/server/db/schema';
import { Player } from './player';
import type { Round } from './round';
import { SoloType, Team as TeamEnum } from './enums';

export interface GameParticipant {
	playerId: string;
	player?: Player;
	seatPosition: number; // 0-3
}

export class Game implements GameType {
	id: string;
	groupId: string;
	maxRoundCount: number; // 8, 12, 16, 20, 24
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
	 */
	static validate(game: Game): string | null {
		// Validate that Pflicht solo rounds only exist if game has mandatory solos
		const mandatorySoloRounds = game.rounds.filter((r) => r.soloType === SoloType.Pflicht);

		if (mandatorySoloRounds.length > 0 && !game.withMandatorySolos) {
			return 'Pflichtsolo-Runden sind nur bei Spielen mit Pflichtsolo erlaubt';
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
					return `${playerName} hat bereits ein Pflichtsolo gespielt`;
				}
			}

			// Only check for missing mandatory solos when game is complete
			if (game.isComplete()) {
				for (const [playerId, count] of playerMandatorySoloCounts.entries()) {
					if (count === 0) {
						const player = game.participants.find((p) => p.playerId === playerId);
						const playerName = player?.player?.displayName ?? 'Spieler';
						return `${playerName} hat sein Pflichtsolo noch nicht gespielt`;
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

		return null;
	}

	/**
	 * Validate this game instance
	 */
	validate(): string | null {
		return Game.validate(this);
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
			rounds: this.rounds.map((r) => ({
				id: r.id,
				roundNumber: r.roundNumber,
				type: r.type,
				soloType: r.soloType,
				eyesRe: r.eyesRe,
				participants: r.participants.map((p) => ({
					playerId: p.playerId,
					player: p.player ? p.player.toJSON() : null,
					team: p.team,
					calls: p.calls,
					bonuses: p.bonuses
				}))
			}))
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
			json.rounds.map((r: any) => ({
				id: r.id,
				roundNumber: r.roundNumber,
				type: r.type,
				soloType: r.soloType,
				eyesRe: r.eyesRe,
				participants: r.participants.map((p: any) => ({
					playerId: p.playerId,
					player: p.player ? Player.fromJSON(p.player) : undefined,
					team: p.team,
					calls: p.calls || [],
					bonuses: p.bonuses || []
				}))
			}))
		);
	}
}
