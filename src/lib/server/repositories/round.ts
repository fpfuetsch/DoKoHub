import { db } from '$lib/server/db';
import {
	GameRoundTable,
	GameRoundParticipantTable,
	GameRoundCallTable,
	GameRoundBonusTable,
	GameRoundResultTable,
	GameTable,
	GameParticipantTable,
	PlayerTable
} from '$lib/server/db/schema';
import { RoundType, Team, CallType, BonusType, SoloType, RoundResult } from '$lib/server/enums';
import { BaseRepository } from '$lib/server/repositories/base';
import type { GameRoundType, PlayerType } from '$lib/server/db/schema';
import type {
	RoundData,
	GameRoundParticipant,
	GameRoundCall,
	GameRoundBonus
} from '$lib/domain/round';
import { Round } from '$lib/domain/round';
import { Player } from '$lib/domain/player';
import { Game } from '$lib/domain/game';
import { and, eq } from 'drizzle-orm';
import { err, ok, type RepoResult, type RepoVoidResult } from './result';

export class RoundRepository extends BaseRepository {
	private readonly principalId: string;

	constructor(principalId: string) {
		super();
		this.principalId = principalId;
	}

	protected getPrincipalId(): string | undefined {
		return this.principalId;
	}

	async getById(roundId: string, gameId: string, groupId: string): Promise<RepoResult<RoundData>> {
		if (!(await this.roundBelongsToUserGroup(roundId, gameId, groupId))) {
			return err('Runde nicht gefunden oder keine Berechtigung.', 404);
		}
		const roundData = await this.getRoundById(roundId);
		if (!roundData) return err('Runde nicht gefunden.', 404);
		return ok(roundData);
	}

	async getRoundsForGame(gameId: string, groupId: string): Promise<RepoResult<Round[]>> {
		if (!(await this.isGroupMember(groupId, this.principalId))) return err('Forbidden.', 403);

		const gameRow = await db
			.select()
			.from(GameTable)
			.where(and(eq(GameTable.id, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (gameRow.length === 0) return err('Spiel nicht gefunden.', 404);

		const roundRows = await db
			.select()
			.from(GameRoundTable)
			.where(eq(GameRoundTable.gameId, gameId));

		const rounds: Round[] = [];
		for (const roundRow of roundRows) {
			const roundData = roundRow as GameRoundType;
			const participants = await this.getRoundParticipantsWithDetails(roundData.id);

			rounds.push(
				new Round({
					id: roundData.id,
					roundNumber: roundData.roundNumber,
					type: roundData.type,
					soloType: roundData.soloType,
					eyesRe: roundData.eyesRe,
					participants
				})
			);
		}

		return ok(rounds.sort((a, b) => a.roundNumber - b.roundNumber));
	}

	async updateRound(
		roundId: string,
		gameId: string,
		groupId: string,
		round: RoundData
	): Promise<RepoResult<Round>> {
		if (!(await this.roundBelongsToUserGroup(roundId, gameId, groupId))) {
			return err('Runde nicht gefunden oder keine Berechtigung.', 404);
		}

		const existing = await this.getRoundById(roundId);
		if (!existing) return err('Runde nicht gefunden.', 404);

		// Prevent switching between Pflicht/Lust for existing rounds
		const wasMandatory = existing.soloType === SoloType.Pflicht;
		const willBeMandatory = round.soloType === SoloType.Pflicht;
		if (wasMandatory !== willBeMandatory) {
			return err(
				'Für eine bestehende Runde kann nicht geändert werden, ob sie eine Pflicht- oder Lust-Solo-Runde ist.'
			);
		}

		const draft: RoundData = {
			...round,
			id: roundId,
			roundNumber: existing.roundNumber
		};

		const gameRow = await db.select().from(GameTable).where(eq(GameTable.id, gameId)).limit(1);
		if (gameRow.length === 0) return err('Spiel nicht gefunden.', 404);

		const gameData = gameRow[0] as any;

		const roundValidationError = Round.validate(draft, gameData.withMandatorySolos);
		if (roundValidationError) return err(roundValidationError);

		const gameValidationError = await this.validateGameWithRound(
			gameId,
			groupId,
			gameData,
			draft,
			roundId
		);
		if (gameValidationError) return err(gameValidationError);

		await db
			.update(GameRoundTable)
			.set({
				type: draft.type as RoundType,
				soloType: draft.soloType as SoloType | null,
				eyesRe: draft.eyesRe
			})
			.where(eq(GameRoundTable.id, roundId));

		await db.delete(GameRoundCallTable).where(eq(GameRoundCallTable.roundId, roundId));
		await db.delete(GameRoundBonusTable).where(eq(GameRoundBonusTable.roundId, roundId));
		await db
			.delete(GameRoundParticipantTable)
			.where(eq(GameRoundParticipantTable.roundId, roundId));

		await this.persistRoundData(roundId, draft);

		// Calculate and persist round results
		const updatedRound = await this.getRoundById(roundId);
		if (updatedRound) {
			await this.persistRoundResults(roundId, updatedRound);
		}

		if (!updatedRound) return err('Runde konnte nicht aktualisiert werden.');
		return ok(new Round(updatedRound as RoundData));
	}

	async addRound(gameId: string, groupId: string, round: RoundData): Promise<RepoResult<Round>> {
		if (!(await this.isGroupMember(groupId, this.principalId))) return err('Forbidden.', 403);

		const gameRow = await db
			.select()
			.from(GameTable)
			.where(and(eq(GameTable.id, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (gameRow.length === 0) return err('Spiel nicht gefunden.', 404);

		const gameData = gameRow[0] as any;

		const roundCount = await db
			.select()
			.from(GameRoundTable)
			.where(eq(GameRoundTable.gameId, gameId));
		const nextRoundNumber = roundCount.length + 1;
		if (nextRoundNumber > gameData.maxRoundCount) {
			return err('Maximale Rundenzahl erreicht.');
		}

		const draft: RoundData = {
			...round,
			id: 'draft',
			roundNumber: nextRoundNumber
		};

		const roundValidationError = Round.validate(draft, gameData.withMandatorySolos);
		if (roundValidationError) return err(roundValidationError);

		const gameValidationError = await this.validateGameWithRound(gameId, groupId, gameData, draft);
		if (gameValidationError) return err(gameValidationError);

		const [insertedRound] = await db
			.insert(GameRoundTable)
			.values({
				gameId,
				roundNumber: nextRoundNumber,
				type: draft.type as RoundType,
				soloType: draft.soloType as SoloType | null,
				eyesRe: draft.eyesRe
			})
			.returning();

		const roundId = insertedRound.id;
		await this.persistRoundData(roundId, draft);

		// Calculate and persist round results
		const newRound = await this.getRoundById(roundId);
		if (newRound) {
			await this.persistRoundResults(roundId, newRound);
		}

		if (!newRound) return err('Runde konnte nicht erstellt werden.');
		return ok(new Round(newRound as RoundData));
	}

	private async persistRoundData(roundId: string, draft: RoundData): Promise<void> {
		for (const participant of draft.participants) {
			await db
				.insert(GameRoundParticipantTable)
				.values({ roundId, playerId: participant.playerId, team: participant.team as Team });
			for (const call of participant.calls) {
				await db
					.insert(GameRoundCallTable)
					.values({ roundId, playerId: participant.playerId, callType: call.callType as CallType });
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
		const participants = await this.getRoundParticipantsWithDetails(roundId);

		return {
			id: roundData.id,
			roundNumber: roundData.roundNumber,
			type: roundData.type,
			soloType: roundData.soloType,
			eyesRe: roundData.eyesRe,
			participants
		};
	}

	private async validateGameWithRound(
		gameId: string,
		groupId: string,
		gameData: any,
		draftRound: RoundData,
		roundIdToReplace?: string
	): Promise<string | null> {
		const allRounds = await this.getRoundsForGame(gameId, groupId);
		if (!allRounds.ok) return allRounds.error;

		const draftRounds = roundIdToReplace
			? allRounds.value.map((r) => (r.id === roundIdToReplace ? new Round(draftRound) : r))
			: [...allRounds.value, new Round(draftRound)];

		const participants = await this.getGameParticipants(gameId);
		const draftGame = new Game(gameData, participants, draftRounds);
		return Game.validate(draftGame);
	}

	private async getGameParticipants(gameId: string): Promise<any[]> {
		const rows = await db
			.select({ participant: GameParticipantTable, player: PlayerTable })
			.from(GameParticipantTable)
			.innerJoin(PlayerTable, eq(GameParticipantTable.playerId, PlayerTable.id))
			.where(eq(GameParticipantTable.gameId, gameId));

		return rows.map((row) => ({
			playerId: row.participant.playerId,
			player: new Player(row.player as PlayerType),
			seatPosition: row.participant.seatPosition
		}));
	}

	private async getRoundParticipantsWithDetails(roundId: string): Promise<GameRoundParticipant[]> {
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

	private async getCallsForRoundPlayer(
		roundId: string,
		playerId: string
	): Promise<GameRoundCall[]> {
		const rows = await db
			.select()
			.from(GameRoundCallTable)
			.where(
				and(eq(GameRoundCallTable.roundId, roundId), eq(GameRoundCallTable.playerId, playerId))
			);

		return rows.map((row) => ({ playerId: row.playerId, callType: row.callType }));
	}

	private async getBonusesForRoundPlayer(
		roundId: string,
		playerId: string
	): Promise<GameRoundBonus[]> {
		const rows = await db
			.select()
			.from(GameRoundBonusTable)
			.where(
				and(eq(GameRoundBonusTable.roundId, roundId), eq(GameRoundBonusTable.playerId, playerId))
			);

		return rows.map((row) => ({
			playerId: row.playerId,
			bonusType: row.bonusType,
			count: row.count
		}));
	}

	private async roundBelongsToUserGroup(
		roundId: string,
		gameId: string,
		groupId: string
	): Promise<boolean> {
		if (!(await this.isGroupMember(groupId, this.principalId))) return false;

		const roundRow = await db
			.select()
			.from(GameRoundTable)
			.innerJoin(GameTable, eq(GameRoundTable.gameId, GameTable.id))
			.where(
				and(
					eq(GameRoundTable.id, roundId),
					eq(GameRoundTable.gameId, gameId),
					eq(GameTable.groupId, groupId)
				)
			)
			.limit(1);

		return roundRow.length > 0;
	}
}
