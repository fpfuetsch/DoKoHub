import type {
	RoundTypeEnum,
	SoloTypeEnumValue,
	TeamEnumValue,
	CallTypeEnumValue,
	BonusTypeEnumValue
} from '$lib/server/db/schema';
import { Player } from './player';

export interface GameRoundCall {
	playerId: string;
	callType: CallTypeEnumValue;
}

export interface GameRoundBonus {
	playerId: string;
	bonusType: BonusTypeEnumValue;
	count: number;
}

export interface GameRoundParticipant {
	playerId: string;
	player?: Player;
	team: TeamEnumValue;
	calls: GameRoundCall[];
	bonuses: GameRoundBonus[];
}

export interface RoundType {
	id: string;
	roundNumber: number;
	type: RoundTypeEnum;
	soloType: SoloTypeEnumValue | null;
	eyesRe: number;
	participants: GameRoundParticipant[];
}

export class Round implements RoundType {
	id: string;
	roundNumber: number;
	type: RoundTypeEnum;
	soloType: SoloTypeEnumValue | null;
	eyesRe: number;
	participants: GameRoundParticipant[];

	constructor(data: RoundType) {
		this.id = data.id;
		this.roundNumber = data.roundNumber;
		this.type = data.type;
		this.soloType = data.soloType;
		this.eyesRe = data.eyesRe;
		this.participants = data.participants;
	}

	toJSON() {
		return {
			id: this.id,
			roundNumber: this.roundNumber,
			type: this.type,
			soloType: this.soloType,
			eyesRe: this.eyesRe,
			participants: this.participants.map((p) => ({
				playerId: p.playerId,
				player: p.player ? p.player.toJSON() : null,
				team: p.team,
				calls: p.calls,
				bonuses: p.bonuses
			}))
		};
	}

	static fromJSON(json: any): Round {
		return new Round({
			id: json.id,
			roundNumber: json.roundNumber,
			type: json.type,
			soloType: json.soloType,
			eyesRe: json.eyesRe,
			participants: (json.participants || []).map((p: any) => ({
				playerId: p.playerId,
				player: p.player ? Player.fromJSON(p.player) : undefined,
				team: p.team,
				calls: p.calls || [],
				bonuses: p.bonuses || []
			}))
		});
	}

	static validate(round: RoundType): string | null {
		if (round.participants.some((p) => !p.team)) {
			return 'Alle Spieler müssen einem Team zugeordnet werden';
		}

		const reCount = round.participants.filter((p) => p.team === 'RE').length;
		const kontraCount = round.participants.filter((p) => p.team === 'KONTRA').length;
		const isSolo = round.type.startsWith('SOLO');
		const isStilleOrUngeklarteHochzeit =
			round.type === 'HOCHZEIT_STILL' || round.type === 'HOCHZEIT_UNGEKLAERT';

		if (round.eyesRe < 0 || round.eyesRe > 240) {
			return 'Augensumme muss zwischen 0 und 240 liegen';
		}

		if (round.participants.length !== 4) {
			return 'Es müssen genau 4 Teilnehmer gesetzt sein';
		}

		// Validate aggregate bonuses across all players
		const totalFuchs = round.participants.reduce(
			(sum, p) => sum + (p.bonuses.find((b) => b.bonusType === 'FUCHS')?.count ?? 0),
			0
		);
		const totalKarlchen = round.participants.reduce(
			(sum, p) => sum + (p.bonuses.find((b) => b.bonusType === 'KARLCHEN')?.count ?? 0),
			0
		);
		const totalDoko = round.participants.reduce(
			(sum, p) => sum + (p.bonuses.find((b) => b.bonusType === 'DOKO')?.count ?? 0),
			0
		);

		if (totalFuchs < 0 || totalFuchs > 2) return 'Es können max 2 Füchse vergeben werden';
		if (totalKarlchen < 0 || totalKarlchen > 1) return 'Es kann max 1 Karlchen geben';
		if (totalDoko < 0 || totalDoko > 5) return 'Es können max 5 Doppelköpfe vergeben werden';

		if (isSolo || isStilleOrUngeklarteHochzeit) {
			if (reCount !== 1) return 'Es muss genau 1 Spieler im Re-Team sein';
			if (kontraCount !== 3) return 'Es müssen genau 3 Spieler im Kontra-Team sein';
		} else {
			if (reCount !== 2) return 'Es müssen genau 2 Spieler im Re-Team sein';
			if (kontraCount !== 2) return 'Es müssen genau 2 Spieler im Kontra-Team sein';
		}

		for (const participant of round.participants) {
			for (const call of participant.calls) {
				if (call.callType === 'RE' && participant.team !== 'RE') {
					return 'Re-Ansage muss vom Re-Team kommen';
				}
				if (call.callType === 'KONTRA' && participant.team !== 'KONTRA') {
					return 'Kontra-Ansage muss vom Kontra-Team kommen';
				}
			}
		}

		return null;
	}

	validate(): string | null {
		return Round.validate(this);
	}
}
