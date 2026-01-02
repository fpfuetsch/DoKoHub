import { db } from '$lib/server/db';
import {
	GameRoundTable,
	GameRoundParticipantTable,
	GameRoundCallTable,
	GameRoundBonusTable,
	GameRoundResultTable,
	GameTable,
	GameParticipantTable,
	GroupMemberTable,
	PlayerTable,
	RoundType,
	Team,
	CallType,
	BonusType,
	SoloType,
	RoundResult
} from '$lib/server/db/schema';
import type {
	GameRoundType,
	PlayerType
} from '$lib/server/db/schema';
import type { RoundData, GameRoundParticipant, GameRoundCall, GameRoundBonus } from '$lib/domain/round';
import { Round } from '$lib/domain/round';
import { Player } from '$lib/domain/player';
import { and, eq } from 'drizzle-orm';

export class RoundRepository {
	constructor(private readonly principalId: string) {}

	async getById(roundId: string, gameId: string, groupId: string): Promise<RoundData | null> {
		if (!(await this.roundBelongsToUserGroup(roundId, gameId, groupId))) return null;
		return this.getRoundById(roundId);
	}

	async getRoundsForGame(gameId: string, groupId: string): Promise<RoundData[]> {
		if (!(await this.isGroupMember(groupId))) return [];

		const gameRow = await db
			.select()
			.from(GameTable)
			.where(and(eq(GameTable.id, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (gameRow.length === 0) return [];

		const roundRows = await db
			.select()
			.from(GameRoundTable)
			.where(eq(GameRoundTable.gameId, gameId));

		const rounds: RoundData[] = [];
		for (const roundRow of roundRows) {
			const roundData = roundRow as GameRoundType;
			const participants = await this.getParticipantsForRound(roundData.id);

			rounds.push({
				id: roundData.id,
				roundNumber: roundData.roundNumber,
				type: roundData.type,
				soloType: roundData.soloType,
				eyesRe: roundData.eyesRe,
				participants
			});
		}

		return rounds.sort((a, b) => a.roundNumber - b.roundNumber);
	}

	async updateRound(roundId: string, gameId: string, groupId: string, round: RoundData): Promise<RoundData | null> {
		if (!(await this.roundBelongsToUserGroup(roundId, gameId, groupId))) return null;

		const existing = await this.getRoundById(roundId);
		if (!existing) return null;

		const gameParticipantIds = await this.getGameParticipantIds(gameId);
		const roundParticipantIds = new Set(round.participants.map((p) => p.playerId));
		if (gameParticipantIds.size !== roundParticipantIds.size || ![...roundParticipantIds].every((id) => gameParticipantIds.has(id))) {
			throw new Error('Teilnehmer stimmen nicht mit dem Spiel überein');
		}

		const draft: RoundData = {
			...round,
			id: roundId,
			roundNumber: existing.roundNumber
		};

		const validationError = Round.validate(draft);
		if (validationError) throw new Error(validationError);

		await db.update(GameRoundTable).set({ type: draft.type as RoundType, soloType: draft.soloType as SoloType | null, eyesRe: draft.eyesRe }).where(eq(GameRoundTable.id, roundId));

		await db.delete(GameRoundCallTable).where(eq(GameRoundCallTable.roundId, roundId));
		await db.delete(GameRoundBonusTable).where(eq(GameRoundBonusTable.roundId, roundId));
		await db.delete(GameRoundParticipantTable).where(eq(GameRoundParticipantTable.roundId, roundId));

		for (const participant of draft.participants) {
			await db.insert(GameRoundParticipantTable).values({ roundId, playerId: participant.playerId, team: participant.team as Team });
			for (const call of participant.calls) {
				await db.insert(GameRoundCallTable).values({ roundId, playerId: participant.playerId, callType: call.callType as CallType });
			}
			for (const bonus of participant.bonuses) {
				await db.insert(GameRoundBonusTable).values({
					roundId,
					playerId: participant.playerId,
					bonusType: bonus.bonusType as BonusType,
					count: bonus.count
				});
			}
		}

		// Calculate and persist round results
		const updatedRound = await this.getRoundById(roundId);
		if (updatedRound) {
			await this.persistRoundResults(roundId, updatedRound);
		}

		return updatedRound;
	}

	async deleteRound(roundId: string, gameId: string, groupId: string): Promise<boolean> {
		if (!(await this.roundBelongsToUserGroup(roundId, gameId, groupId))) return false;

		// Cleanup round results first
		await db.delete(GameRoundResultTable).where(eq(GameRoundResultTable.roundId, roundId));

		await db.delete(GameRoundBonusTable).where(eq(GameRoundBonusTable.roundId, roundId));
		await db.delete(GameRoundCallTable).where(eq(GameRoundCallTable.roundId, roundId));
		await db.delete(GameRoundParticipantTable).where(eq(GameRoundParticipantTable.roundId, roundId));

		const result = await db.delete(GameRoundTable).where(eq(GameRoundTable.id, roundId)).returning();
		return result.length > 0;
	}

	async addRound(gameId: string, groupId: string, round: RoundData): Promise<RoundData | null> {
		if (!(await this.isGroupMember(groupId))) return null;

		const gameRow = await db
			.select()
			.from(GameTable)
			.where(and(eq(GameTable.id, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (gameRow.length === 0) return null;

		const gameParticipantIds = await this.getGameParticipantIds(gameId);
		const roundParticipantIds = new Set(round.participants.map((p) => p.playerId));
		if (gameParticipantIds.size !== roundParticipantIds.size || ![...roundParticipantIds].every((id) => gameParticipantIds.has(id))) {
			throw new Error('Teilnehmer stimmen nicht mit dem Spiel überein');
		}

		const roundCount = await db.select().from(GameRoundTable).where(eq(GameRoundTable.gameId, gameId));
		const nextRoundNumber = roundCount.length + 1;

		const draft: RoundData = {
			...round,
			id: 'draft',
			roundNumber: nextRoundNumber
		};

		const validationError = Round.validate(draft);
		if (validationError) throw new Error(validationError);

		const [insertedRound] = await db
			.insert(GameRoundTable)
			.values({ gameId, roundNumber: nextRoundNumber, type: draft.type as RoundType, soloType: draft.soloType as SoloType | null, eyesRe: draft.eyesRe })
			.returning();

		const roundId = insertedRound.id;

		for (const participant of draft.participants) {
			await db.insert(GameRoundParticipantTable).values({ roundId, playerId: participant.playerId, team: participant.team as Team });
			for (const call of participant.calls) {
				await db.insert(GameRoundCallTable).values({ roundId, playerId: participant.playerId, callType: call.callType as CallType });
			}
			for (const bonus of participant.bonuses) {
				await db.insert(GameRoundBonusTable).values({
					roundId,
					playerId: participant.playerId,
					bonusType: bonus.bonusType as BonusType,
					count: bonus.count
				});
			}
		}

		// Calculate and persist round results
		const newRound = await this.getRoundById(roundId);
		if (newRound) {
			await this.persistRoundResults(roundId, newRound);
		}

		return newRound;
	}

	private async persistRoundResults(roundId: string, round: RoundData): Promise<void> {
		try {
			// Calculate points for this round
			const roundInstance = new Round(round);
			const roundPoints = roundInstance.calculatePoints();

			// Delete existing results for this round
			await db.delete(GameRoundResultTable).where(eq(GameRoundResultTable.roundId, roundId));

			// Insert new results
			await db.insert(GameRoundResultTable).values(
				roundPoints.map((rp: { playerId: string; points: number; result: string }) => ({
					roundId,
					playerId: rp.playerId,
					points: rp.points,
					result: rp.result as RoundResult
				}))
			);
		} catch (error) {
			// Log error but don't fail the round operation if persistence fails
			console.error(`Failed to persist round results for round ${roundId}:`, error);
		}
	}

	private async getRoundById(roundId: string): Promise<RoundData | null> {
		const roundRow = await db
			.select()
			.from(GameRoundTable)
			.where(eq(GameRoundTable.id, roundId))
			.limit(1);

		if (roundRow.length === 0) return null;

		const roundData = roundRow[0] as GameRoundType;
		const participants = await this.getParticipantsForRound(roundId);

		return {
			id: roundData.id,
			roundNumber: roundData.roundNumber,
			type: roundData.type,
			soloType: roundData.soloType,
			eyesRe: roundData.eyesRe,
			participants
		};
	}

	private async getGameParticipantIds(gameId: string): Promise<Set<string>> {
		const rows = await db.select().from(GameParticipantTable).where(eq(GameParticipantTable.gameId, gameId));
		return new Set(rows.map((row) => row.playerId));
	}

	private async getParticipantsForRound(roundId: string): Promise<GameRoundParticipant[]> {
		const rows = await db
			.select({ participant: GameRoundParticipantTable, player: PlayerTable })
			.from(GameRoundParticipantTable)
			.innerJoin(PlayerTable, eq(GameRoundParticipantTable.playerId, PlayerTable.id))
			.where(eq(GameRoundParticipantTable.roundId, roundId));

		const participants: GameRoundParticipant[] = [];
		for (const row of rows) {
			const calls = await this.getCallsForRoundPlayer(roundId, row.participant.playerId);
			const bonuses = await this.getBonusesForRoundPlayer(roundId, row.participant.playerId);

			participants.push({
				playerId: row.participant.playerId,
				player: new Player(row.player as PlayerType),
				team: row.participant.team,
				calls,
				bonuses
			});
		}

		return participants;
	}

	private async getCallsForRoundPlayer(roundId: string, playerId: string): Promise<GameRoundCall[]> {
		const rows = await db
			.select()
			.from(GameRoundCallTable)
			.where(and(eq(GameRoundCallTable.roundId, roundId), eq(GameRoundCallTable.playerId, playerId)));

		return rows.map((row) => ({ playerId: row.playerId, callType: row.callType }));
	}

	private async getBonusesForRoundPlayer(roundId: string, playerId: string): Promise<GameRoundBonus[]> {
		const rows = await db
			.select()
			.from(GameRoundBonusTable)
			.where(and(eq(GameRoundBonusTable.roundId, roundId), eq(GameRoundBonusTable.playerId, playerId)));

		return rows.map((row) => ({ playerId: row.playerId, bonusType: row.bonusType, count: row.count }));
	}

	private async roundBelongsToUserGroup(roundId: string, gameId: string, groupId: string): Promise<boolean> {
		if (!(await this.isGroupMember(groupId))) return false;

		const roundRow = await db
			.select()
			.from(GameRoundTable)
			.innerJoin(GameTable, eq(GameRoundTable.gameId, GameTable.id))
			.where(
				and(eq(GameRoundTable.id, roundId), eq(GameRoundTable.gameId, gameId), eq(GameTable.groupId, groupId))
			)
			.limit(1);

		return roundRow.length > 0;
	}

	private async isGroupMember(groupId: string): Promise<boolean> {
		const result = await db
			.select({})
			.from(GroupMemberTable)
			.where(and(eq(GroupMemberTable.groupId, groupId), eq(GroupMemberTable.playerId, this.principalId)))
			.limit(1);
		return result.length > 0;
	}
}
