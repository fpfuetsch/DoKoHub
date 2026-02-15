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

export interface TeamPointBreakdown {
	basePoints: number;
	baseDetails: { label: string; points: number }[];
	opponentBasePoints: number;
	baseDelta: number;
	callDelta: number;
	callDetails: { label: string; points: number }[];
	overcompliancePoints: number;
	overcomplianceDetails: { label: string; points: number }[];
	opponentOvercompliancePoints: number;
	overcomplianceDelta: number;
	bonusPoints: number;
	bonusDetails: { label: string; points: number }[];
	opponentBonusPoints: number;
	bonusDelta: number;
	totalPoints: number;
}

export interface RoundPointsExplanation {
	reThreshold: number;
	kontraThreshold: number;
	reWon: boolean;
	kontraWon: boolean;
	callPoints: number;
	isSolo: boolean;
	re: TeamPointBreakdown;
	kontra: TeamPointBreakdown;
	soloRePoints: number;
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
		const isSolo =
			round instanceof Round
				? round.isSolo()
				: round.type !== RoundType.Normal && round.type !== RoundType.HochzeitNormal;
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
		const explanation = this.calculatePointsExplanation();

		// Distribute points to players
		return this.participants.map((p) => ({
			playerId: p.playerId,
			points: p.team === Team.RE ? explanation.soloRePoints : explanation.kontra.totalPoints,
			result:
				p.team === Team.RE
					? explanation.reWon
						? RoundResult.WON
						: explanation.kontraWon
							? RoundResult.LOST
							: RoundResult.DRAW
					: explanation.kontraWon
						? RoundResult.WON
						: explanation.reWon
							? RoundResult.LOST
							: RoundResult.DRAW
		}));
	}

	calculatePointsExplanation(): RoundPointsExplanation {
		const { reThreshold, kontraThreshold } = this.calculateThresholds();

		const reWon = this.eyesRe >= reThreshold;
		const kontraWon = 240 - this.eyesRe >= kontraThreshold;

		const reBasePoints = this.calculateBasePointsForTeam(Team.RE, reWon);
		const kontraBasePoints = this.calculateBasePointsForTeam(Team.KONTRA, kontraWon);

		const callPoints = reWon || kontraWon ? this.calculateCallPoints() : 0;
		const reCallDelta = reWon ? callPoints : kontraWon ? -callPoints : 0;
		const kontraCallDelta = kontraWon ? callPoints : reWon ? -callPoints : 0;

		const reOvercompliance = this.calculateOvercompliancePointsForTeam(Team.RE);
		const kontraOvercompliance = this.calculateOvercompliancePointsForTeam(Team.KONTRA);
		const reOvercomplianceDelta = reOvercompliance - kontraOvercompliance;
		const kontraOvercomplianceDelta = kontraOvercompliance - reOvercompliance;

		const reBonusPoints = this.calculateBonusPointsForTeam(Team.RE, reWon);
		const kontraBonusPoints = this.calculateBonusPointsForTeam(Team.KONTRA, kontraWon);
		const reBonusDelta = reBonusPoints - kontraBonusPoints;
		const kontraBonusDelta = kontraBonusPoints - reBonusPoints;

		const reTotalPoints =
			reBasePoints - kontraBasePoints + reCallDelta + reOvercomplianceDelta + reBonusDelta;
		const kontraTotalPoints =
			kontraBasePoints -
			reBasePoints +
			kontraCallDelta +
			kontraOvercomplianceDelta +
			kontraBonusDelta;

		const isSolo =
			this.isSolo() ||
			this.type === RoundType.HochzeitStill ||
			this.type === RoundType.HochzeitUngeklaert;

		return {
			reThreshold,
			kontraThreshold,
			reWon,
			kontraWon,
			callPoints,
			isSolo,
			re: {
				basePoints: reBasePoints,
				baseDetails: this.calculateBaseDetailsForTeam(Team.RE, reWon),
				opponentBasePoints: kontraBasePoints,
				baseDelta: reBasePoints - kontraBasePoints,
				callDelta: reCallDelta,
				callDetails: this.calculateCallDetailsForTeam(Team.RE),
				overcompliancePoints: reOvercompliance,
				overcomplianceDetails: this.calculateOvercomplianceDetailsForTeam(Team.RE),
				opponentOvercompliancePoints: kontraOvercompliance,
				overcomplianceDelta: reOvercomplianceDelta,
				bonusPoints: reBonusPoints,
				bonusDetails: this.calculateBonusDetailsForTeam(Team.RE, reWon),
				opponentBonusPoints: kontraBonusPoints,
				bonusDelta: reBonusDelta,
				totalPoints: reTotalPoints
			},
			kontra: {
				basePoints: kontraBasePoints,
				baseDetails: this.calculateBaseDetailsForTeam(Team.KONTRA, kontraWon),
				opponentBasePoints: reBasePoints,
				baseDelta: kontraBasePoints - reBasePoints,
				callDelta: kontraCallDelta,
				callDetails: this.calculateCallDetailsForTeam(Team.KONTRA),
				overcompliancePoints: kontraOvercompliance,
				overcomplianceDetails: this.calculateOvercomplianceDetailsForTeam(Team.KONTRA),
				opponentOvercompliancePoints: reOvercompliance,
				overcomplianceDelta: kontraOvercomplianceDelta,
				bonusPoints: kontraBonusPoints,
				bonusDetails: this.calculateBonusDetailsForTeam(Team.KONTRA, kontraWon),
				opponentBonusPoints: reBonusPoints,
				bonusDelta: kontraBonusDelta,
				totalPoints: kontraTotalPoints
			},
			soloRePoints: isSolo ? reTotalPoints * 3 : reTotalPoints
		};
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
		return this.calculateBaseDetailsForTeam(team, won).reduce(
			(sum, detail) => sum + detail.points,
			0
		);
	}

	private calculateBaseDetailsForTeam(
		team: TeamEnumValue,
		won: boolean
	): { label: string; points: number }[] {
		const details: { label: string; points: number }[] = [];
		const enemyEyes = team === Team.RE ? 240 - this.eyesRe : this.eyesRe;

		if (won) details.push({ label: 'Sieg', points: 1 });
		if (enemyEyes < 90) details.push({ label: 'Gegner unter 90', points: 1 });
		if (enemyEyes < 60) details.push({ label: 'Gegner unter 60', points: 1 });
		if (enemyEyes < 30) details.push({ label: 'Gegner unter 30', points: 1 });
		if (enemyEyes === 0) details.push({ label: 'Gegner schwarz', points: 1 });

		return details;
	}

	private calculateCallPoints(): number {
		const reCallPoints = this.calculateCallDetailsForTeam(Team.RE).reduce(
			(sum, detail) => sum + detail.points,
			0
		);
		const kontraCallPoints = this.calculateCallDetailsForTeam(Team.KONTRA).reduce(
			(sum, detail) => sum + detail.points,
			0
		);

		return reCallPoints + kontraCallPoints;
	}

	private calculateCallDetailsForTeam(team: TeamEnumValue): { label: string; points: number }[] {
		const teamCalls = this.getCallsForTeam(team);
		const details: { label: string; points: number }[] = [];

		if (team === Team.RE && teamCalls.RE) details.push({ label: 'Re', points: 2 });
		if (team === Team.KONTRA && teamCalls.KONTRA) details.push({ label: 'Kontra', points: 2 });

		if (teamCalls.KEINE90) details.push({ label: 'K90', points: 1 });
		if (teamCalls.KEINE60) details.push({ label: 'K60', points: 1 });
		if (teamCalls.KEINE30) details.push({ label: 'Keine 30', points: 1 });
		if (teamCalls.SCHWARZ) details.push({ label: 'Schwarz', points: 1 });

		return details;
	}

	private calculateOvercompliancePointsForTeam(team: TeamEnumValue): number {
		return this.calculateOvercomplianceDetailsForTeam(team).reduce(
			(sum, detail) => sum + detail.points,
			0
		);
	}

	private calculateOvercomplianceDetailsForTeam(
		team: TeamEnumValue
	): { label: string; points: number }[] {
		const details: { label: string; points: number }[] = [];

		const enemyTeam = team === Team.RE ? Team.KONTRA : Team.RE;
		const enemyCalls = this.getCallsForTeam(enemyTeam);
		const eyes = team === Team.RE ? this.eyesRe : 240 - this.eyesRe;

		if (enemyCalls.KEINE90 && eyes >= 120) details.push({ label: '120 gegen K90', points: 1 });
		if (enemyCalls.KEINE60 && eyes >= 90) details.push({ label: '90 gegen K60', points: 1 });
		if (enemyCalls.KEINE30 && eyes >= 60) details.push({ label: '60 gegen Keine 30', points: 1 });
		if (enemyCalls.SCHWARZ && eyes >= 30) details.push({ label: '30 gegen Schwarz', points: 1 });

		return details;
	}

	private calculateBonusPointsForTeam(team: TeamEnumValue, won: boolean): number {
		return this.calculateBonusDetailsForTeam(team, won).reduce(
			(sum, detail) => sum + detail.points,
			0
		);
	}

	private calculateBonusDetailsForTeam(
		team: TeamEnumValue,
		won: boolean
	): { label: string; points: number }[] {
		const details: { label: string; points: number }[] = [];

		const bonusesAllowed = this.type === RoundType.Normal || this.type === RoundType.HochzeitNormal;
		if (!bonusesAllowed) return details;

		if (team === Team.KONTRA && won) {
			details.push({ label: 'Sieg gegen Kreuz-Damen', points: 1 });
		}

		let fuchs = 0;
		let doko = 0;
		let karlchen = 0;

		for (const participant of this.participants) {
			if (participant.team !== team) continue;
			for (const bonus of participant.bonuses) {
				if (bonus.bonusType === BonusType.Fuchs) fuchs += bonus.count;
				if (bonus.bonusType === BonusType.Doko) doko += bonus.count;
				if (bonus.bonusType === BonusType.Karlchen) karlchen += bonus.count;
			}
		}

		if (fuchs > 0) details.push({ label: 'Fuchs', points: fuchs });
		if (doko > 0) details.push({ label: 'DoKo', points: doko });
		if (karlchen > 0) details.push({ label: 'Karlchen', points: karlchen });

		return details;
	}
}
