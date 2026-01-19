import type {
	RoundTypeEnum,
	SoloTypeEnumValue,
	TeamEnumValue,
	CallTypeEnumValue,
	BonusTypeEnumValue,
	RoundResultEnumValue
} from '$lib/domain/enums';
import { Team, CallType, BonusType, RoundType, RoundResult, SoloType } from '$lib/domain/enums';
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

export interface RoundData {
	id: string;
	roundNumber: number;
	type: RoundTypeEnum;
	soloType: SoloTypeEnumValue | null;
	eyesRe: number;
	participants: GameRoundParticipant[];
}

export interface RoundPoints {
	playerId: string;
	points: number;
	result: RoundResultEnumValue;
}

export class Round implements RoundData {
	id: string;
	roundNumber: number;
	type: RoundTypeEnum;
	soloType: SoloTypeEnumValue | null;
	eyesRe: number;
	participants: GameRoundParticipant[];

	constructor(data: RoundData) {
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

	/**
	 * Check if this round is a mandatory solo
	 */
	isMandatorySolo(): boolean {
		return this.isSolo() && this.soloType === SoloType.Pflicht;
	}

	/**
	 * Check if this round is a solo variant (any type that is not Normal or HochzeitNormal)
	 */
	isSolo(): boolean {
		return this.type !== RoundType.Normal && this.type !== RoundType.HochzeitNormal;
	}

	static validate(round: RoundData, withMandatorySolos: boolean = false): string | null {
		// Validate solo type is only LUST or PFLICHT when game has mandatory solos
		if (round.soloType && !withMandatorySolos) {
			if (round.soloType === SoloType.Lust || round.soloType === SoloType.Pflicht) {
				return 'Solotyp (Lust- oder Pflichtsolo) ist nur bei Spielen mit Pflichtsolo erlaubt.';
			}
		}

		if (round.participants.some((p) => !p.team)) {
			return 'Alle Spieler müssen einem Team zugeordnet werden.';
		}

		const reCount = round.participants.filter((p) => p.team === Team.RE).length;
		const kontraCount = round.participants.filter((p) => p.team === Team.KONTRA).length;
		const isSolo = round instanceof Round ? round.isSolo() : (round.type !== RoundType.Normal && round.type !== RoundType.HochzeitNormal);
		const isStilleOrUngeklarteHochzeit =
			round.type === RoundType.HochzeitStill || round.type === RoundType.HochzeitUngeklaert;

		if (round.eyesRe < 0 || round.eyesRe > 240) {
			return 'Augensumme muss >= 0 und <= 240 sein.';
		}

		if (round.participants.length !== 4) {
			return 'Es müssen genau 4 Teilnehmer gesetzt sein.';
		}

		// Validate aggregate bonuses across all players
		const totalFuchs = round.participants.reduce(
			(sum, p) => sum + (p.bonuses.find((b) => b.bonusType === BonusType.Fuchs)?.count ?? 0),
			0
		);
		const totalKarlchen = round.participants.reduce(
			(sum, p) => sum + (p.bonuses.find((b) => b.bonusType === BonusType.Karlchen)?.count ?? 0),
			0
		);
		const totalDoko = round.participants.reduce(
			(sum, p) => sum + (p.bonuses.find((b) => b.bonusType === BonusType.Doko)?.count ?? 0),
			0
		);

		const bonusesAllowed =
			round.type === RoundType.Normal || round.type === RoundType.HochzeitNormal;
		if (!bonusesAllowed && (totalFuchs > 0 || totalKarlchen > 0 || totalDoko > 0)) {
			return 'Bonuspunkte werden nur in Normalspielen oder normaler Hochzeit gewertet.';
		}

		if (totalFuchs < 0 || totalFuchs > 2) return 'Es können max. 2 Füchse gefangen werden.';
		if (totalKarlchen < 0 || totalKarlchen > 1) return 'Es kann max. 1 Karlchen geben.';
		if (totalDoko < 0 || totalDoko > 5) return 'Es können max. 5 Doppelköpfe vergeben werden.';

		if (isSolo || isStilleOrUngeklarteHochzeit) {
			if (reCount !== 1) return 'Es muss genau 1 Spieler im Re-Team sein.';
			if (kontraCount !== 3) return 'Es müssen genau 3 Spieler im Kontra-Team sein.';
		} else {
			if (reCount !== 2) return 'Es müssen genau 2 Spieler im Re-Team sein.';
			if (kontraCount !== 2) return 'Es müssen genau 2 Spieler im Kontra-Team sein.';
		}

		for (const participant of round.participants) {
			for (const call of participant.calls) {
				if (call.callType === CallType.RE && participant.team !== Team.RE) {
					return 'Re-Ansage muss vom Re-Team kommen.';
				}
				if (call.callType === CallType.KONTRA && participant.team !== Team.KONTRA) {
					return 'Kontra-Ansage muss vom Kontra-Team kommen.';
				}
			}
		}

		return null;
	}

	validate(withMandatorySolos: boolean = false): string | null {
		return Round.validate(this, withMandatorySolos);
	}

	/**
	 * Calculate points for each player based on round results
	 * Returns RoundPoints array where winning team gets positive points and losing team gets negative
	 */
	calculatePoints(): RoundPoints[] {
		// Calculate required points for each team to win
		const { reThreshold, kontraThreshold } = this.calculateThresholds();

		// Determine if RE or KONTRA won
		const reWon = this.eyesRe >= reThreshold;
		const kontraWon = 240 - this.eyesRe >= kontraThreshold;

		let rePoints = 0;
		let kontraPoints = 0;

		// Calculate base points per team (always calculated)
		const reBasePoints = this.calculateBasePointsForTeam(Team.RE, reWon);
		const kontraBasePoints = this.calculateBasePointsForTeam(Team.KONTRA, kontraWon);
		rePoints = reBasePoints - kontraBasePoints;
		kontraPoints = kontraBasePoints - reBasePoints;

		// Calculate call points (only if somebody won)
		const callPoints = reWon || kontraWon ? this.calculateCallPoints() : 0;
		if (reWon) {
			rePoints += callPoints;
			kontraPoints -= callPoints;
		} else if (kontraWon) {
			kontraPoints += callPoints;
			rePoints -= callPoints;
		}

		// Calculate overcompliance points per team (always calculated)
		const reOvercompliance = this.calculateOvercompliancePointsForTeam(Team.RE);
		const kontraOvercompliance = this.calculateOvercompliancePointsForTeam(Team.KONTRA);
		rePoints += reOvercompliance - kontraOvercompliance;
		kontraPoints += kontraOvercompliance - reOvercompliance;

		// Calculate bonus points per team (when available)
		const reBonusPoints = this.calculateBonusPointsForTeam(Team.RE, reWon);
		const kontraBonusPoints = this.calculateBonusPointsForTeam(Team.KONTRA, kontraWon);
		rePoints += reBonusPoints - kontraBonusPoints;
		kontraPoints += kontraBonusPoints - reBonusPoints;

		// In solo games (including stille and ungeklärte hochzeit), the solo player (RE) gets 3x the points
		const isSolo = this.isSolo() || this.type === RoundType.HochzeitStill || this.type === RoundType.HochzeitUngeklaert;
		const soloRePoints = isSolo ? rePoints * 3 : rePoints;

		// Distribute points to players
		return this.participants.map((p) => ({
			playerId: p.playerId,
			points: p.team === Team.RE ? soloRePoints : kontraPoints,
			result:
				p.team === Team.RE
					? reWon
						? RoundResult.WON
						: kontraWon
							? RoundResult.LOST
							: RoundResult.DRAW
					: kontraWon
						? RoundResult.WON
						: reWon
							? RoundResult.LOST
							: RoundResult.DRAW
		}));
	}

	private calculateThresholds(): { reThreshold: number; kontraThreshold: number } {
		const reCalls = this.getCallsForTeam(Team.RE);
		const kontraCalls = this.getCallsForTeam(Team.KONTRA);

		let reThreshold = 121;
		let kontraThreshold = 120;

		if (kontraCalls.KONTRA && !reCalls.RE) {
			reThreshold = 120;
			kontraThreshold = 121;
		}

		// RE team calls increase RE's threshold
		if (reCalls.SCHWARZ) reThreshold = 240;
		else if (reCalls.KEINE30) reThreshold = 211;
		else if (reCalls.KEINE60) reThreshold = 181;
		else if (reCalls.KEINE90) reThreshold = 151;
		// If RE has no "absagen", KONTRA's calls lower RE's threshold
		else if (kontraCalls.SCHWARZ) reThreshold = 0;
		else if (kontraCalls.KEINE30) reThreshold = 30;
		else if (kontraCalls.KEINE60) reThreshold = 60;
		else if (kontraCalls.KEINE90) reThreshold = 90;

		// KONTRA team calls increase KONTRA's threshold
		if (kontraCalls.SCHWARZ) kontraThreshold = 240;
		else if (kontraCalls.KEINE30) kontraThreshold = 211;
		else if (kontraCalls.KEINE60) kontraThreshold = 181;
		else if (kontraCalls.KEINE90) kontraThreshold = 151;
		// If KONTRA has no calls, RE's calls lower KONTRA's threshold
		else if (reCalls.SCHWARZ) kontraThreshold = 0;
		else if (reCalls.KEINE30) kontraThreshold = 30;
		else if (reCalls.KEINE60) kontraThreshold = 60;
		else if (reCalls.KEINE90) kontraThreshold = 90;

		return { reThreshold, kontraThreshold };
	}

	private getCallsForTeam(team: TeamEnumValue): {
		RE: boolean;
		KONTRA: boolean;
		KEINE90: boolean;
		KEINE60: boolean;
		KEINE30: boolean;
		SCHWARZ: boolean;
	} {
		const calls = {
			RE: false,
			KONTRA: false,
			KEINE90: false,
			KEINE60: false,
			KEINE30: false,
			SCHWARZ: false
		};

		for (const participant of this.participants) {
			if (participant.team === team) {
				for (const call of participant.calls) {
					// Any call by the team implies their team call (RE or KONTRA)
					if (team === Team.RE) {
						calls.RE = true;
					} else {
						calls.KONTRA = true;
					}

					// Higher calls imply all lower calls
					if (call.callType === CallType.Schwarz) {
						calls.SCHWARZ = true;
						calls.KEINE30 = true;
						calls.KEINE60 = true;
						calls.KEINE90 = true;
					} else if (call.callType === CallType.Keine30) {
						calls.KEINE30 = true;
						calls.KEINE60 = true;
						calls.KEINE90 = true;
					} else if (call.callType === CallType.Keine60) {
						calls.KEINE60 = true;
						calls.KEINE90 = true;
					} else if (call.callType === CallType.Keine90) {
						calls.KEINE90 = true;
					}
				}
			}
		}

		return calls;
	}

	private calculateBasePointsForTeam(team: TeamEnumValue, won: boolean): number {
		let points = 0;
		const enemyEyes = team === Team.RE ? 240 - this.eyesRe : this.eyesRe;

		// Win point
		if (won) {
			points += 1;
		}

		// Points for high eye counts against enemy
		if (enemyEyes < 90) points += 1;
		if (enemyEyes < 60) points += 1;
		if (enemyEyes < 30) points += 1;
		if (enemyEyes === 0) points += 1;

		return points;
	}

	private calculateCallPoints(): number {
		let points = 0;

		// Points for fulfilled calls (Absagen) - combined for whoever won
		const reCalls = this.getCallsForTeam(Team.RE);
		const kontraCalls = this.getCallsForTeam(Team.KONTRA);

		// Ansagen points
		if (reCalls.RE) points += 2;
		if (kontraCalls.KONTRA) points += 2;

		// Absagen points - each absage type counts as 1 point
		if (reCalls.KEINE90) points += 1;
		if (reCalls.KEINE60) points += 1;
		if (reCalls.KEINE30) points += 1;
		if (reCalls.SCHWARZ) points += 1;
		if (kontraCalls.KEINE90) points += 1;
		if (kontraCalls.KEINE60) points += 1;
		if (kontraCalls.KEINE30) points += 1;
		if (kontraCalls.SCHWARZ) points += 1;

		return points;
	}

	private calculateOvercompliancePointsForTeam(team: TeamEnumValue): number {
		let points = 0;

		const enemyTeam = team === Team.RE ? Team.KONTRA : Team.RE;
		const enemyCalls = this.getCallsForTeam(enemyTeam);
		const eyes = team === Team.RE ? this.eyesRe : 240 - this.eyesRe;

		if (enemyCalls.KEINE90 && eyes >= 120) points += 1; // 120 eyes against "keine 90"
		if (enemyCalls.KEINE60 && eyes >= 90) points += 1; // 90 eyes against "keine 60"
		if (enemyCalls.KEINE30 && eyes >= 60) points += 1; // 60 eyes against "keine 30"
		if (enemyCalls.SCHWARZ && eyes >= 30) points += 1; // 30 eyes against "schwarz"

		return points;
	}

	private calculateBonusPointsForTeam(team: TeamEnumValue, won: boolean): number {
		let points = 0;

		// Only award bonus points for normal rounds and normal hochzeit
		const bonusesAllowed = this.type === RoundType.Normal || this.type === RoundType.HochzeitNormal;
		if (!bonusesAllowed) return 0;

		// Kreuz damen: +1 wenn KONTRA gegen RE gewinnt
		if (team === Team.KONTRA && won) {
			points += 1;
		}

		// Collect all bonuses for team members
		for (const participant of this.participants) {
			if (participant.team === team) {
				for (const bonus of participant.bonuses) {
					if (
						bonus.bonusType === BonusType.Doko ||
						bonus.bonusType === BonusType.Fuchs ||
						bonus.bonusType === BonusType.Karlchen
					) {
						points += bonus.count;
					}
				}
			}
		}

		return points;
	}
}
