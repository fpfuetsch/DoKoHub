import type { GameType } from '$lib/server/db/schema';
import { Player } from './player';
import type { Round } from './round';

export interface GameParticipant {
	playerId: string;
	player?: Player;
	seatPosition: number; // 0-3
}

export class Game implements GameType {
	id: string;
	groupId: string;
	maxRoundCount: number; // 4, 8, 12, 16, 20, 24
	withMandatorySolos: boolean;
	createdAt: Date;
	endedAt: Date | null;
	participants: GameParticipant[] = [];
	rounds: Round[] = [];

	constructor(
		data: GameType,
		participants: GameParticipant[] = [],
		rounds: Round[] = []
	) {
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
