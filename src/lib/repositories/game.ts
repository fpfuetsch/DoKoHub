import { db } from '$lib/server/db';
import {
	GameTable,
	GameParticipantTable,
	GameRoundTable,
	GameRoundParticipantTable,
	GameRoundCallTable,
	GameRoundBonusTable,
	PlayerTable,
	GroupMemberTable
} from '$lib/server/db/schema';
import { Game, type GameParticipant, type GameRound, type GameRoundParticipant, type GameRoundCall, type GameRoundBonus } from '$lib/domain/game';
import { Player } from '$lib/domain/player';
import type {
	GameType,
	GameRoundType,
	RoundTypeEnum,
	SoloTypeEnumValue,
	TeamEnumValue,
	CallTypeEnumValue,
	BonusTypeEnumValue,
	PlayerType
} from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export class GameRepository {
	constructor(private readonly principalId: string) {}

	async getById(id: string, groupId: string): Promise<Game | null> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return null;

		const gameRow = await db
			.select()
			.from(GameTable)
			.where(and(eq(GameTable.id, id), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (gameRow.length === 0) return null;

		const gameData = gameRow[0] as GameType;
		const participants = await this.getParticipantsForGame(gameData.id);
		const rounds = await this.getRoundsForGame(gameData.id);
		return new Game(gameData, participants, rounds);
	}

	async listByGroup(groupId: string): Promise<Game[]> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return [];

		const gameRows = await db
			.select()
			.from(GameTable)
			.where(eq(GameTable.groupId, groupId));

		const games: Game[] = [];
		for (const gameRow of gameRows) {
			const gameData = gameRow as GameType;
			const participants = await this.getParticipantsForGame(gameData.id);
			const rounds = await this.getRoundsForGame(gameData.id);
			games.push(new Game(gameData, participants, rounds));
		}
		return games;
	}

	async create(
		groupId: string,
		maxRoundCount: number,
		withMandatorySolos: boolean,
		participantIds: string[] = []
	): Promise<Game | null> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return null;

		// Validate maxRoundCount
		const validRoundCounts = [4, 8, 12, 16, 20, 24];
		if (!validRoundCounts.includes(maxRoundCount)) {
			throw new Error('Gültige Rundenanzahlen sind: 4, 8, 12, 16, 20, 24');
		}

		// Validate max 4 participants
		if (participantIds.length > 4) {
			throw new Error('Maximale Anzahl der Teilnehmer ist 4');
		}

		const [inserted] = await db
			.insert(GameTable)
			.values({
				groupId,
				maxRoundCount,
				withMandatorySolos
			})
			.returning();

		const gameInstance = new Game(inserted as GameType);

		// Add participants with seat positions
		const uniqueParticipantIds = [...new Set(participantIds)];
		for (let i = 0; i < uniqueParticipantIds.length; i++) {
			await db.insert(GameParticipantTable).values({
				gameId: gameInstance.id,
				playerId: uniqueParticipantIds[i],
				seatPosition: String(i) // 0-3
			});
		}

		gameInstance.participants = await this.getParticipantsForGame(gameInstance.id);
		return gameInstance;
	}

	async updateEndTime(id: string, groupId: string, endedAt: Date): Promise<Game | null> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return null;

		const [updated] = await db
			.update(GameTable)
			.set({ endedAt })
			.where(and(eq(GameTable.id, id), eq(GameTable.groupId, groupId)))
			.returning();

		if (!updated) return null;

		const participants = await this.getParticipantsForGame(updated.id);
		const rounds = await this.getRoundsForGame(updated.id);
		return new Game(updated as GameType, participants, rounds);
	}

	async addParticipant(
		gameId: string,
		groupId: string,
		playerId: string,
		seatPosition: number
	): Promise<boolean> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return false;

		// Verify game belongs to group and check if max participants reached
		const gameRow = await db
			.select()
			.from(GameTable)
			.where(and(eq(GameTable.id, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (gameRow.length === 0) return false;

		const participantCount = await db
			.select()
			.from(GameParticipantTable)
			.where(eq(GameParticipantTable.gameId, gameId));

		if (participantCount.length >= 4) {
			throw new Error('Maximale Anzahl der Teilnehmer ist 4');
		}

		// Validate seat position
		if (seatPosition < 0 || seatPosition > 3) {
			throw new Error('Sitzposition muss zwischen 0 und 3 liegen');
		}

		await db.insert(GameParticipantTable).values({
			gameId,
			playerId,
			seatPosition: String(seatPosition)
		});

		return true;
	}

	async removeParticipant(gameId: string, groupId: string, playerId: string): Promise<boolean> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return false;

		// Verify game belongs to group
		const gameRow = await db
			.select()
			.from(GameTable)
			.where(and(eq(GameTable.id, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (gameRow.length === 0) return false;

		const result = await db
			.delete(GameParticipantTable)
			.where(and(eq(GameParticipantTable.gameId, gameId), eq(GameParticipantTable.playerId, playerId)))
			.returning();

		return result.length > 0;
	}

	async addRound(
		gameId: string,
		groupId: string,
		type: RoundTypeEnum,
		soloType: SoloTypeEnumValue | null,
		eyesRe: number,
		teamAssignments: Map<string, TeamEnumValue> // playerId -> RE/KONTRA
	): Promise<GameRound | null> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return null;

		// Verify game belongs to group
		const gameRow = await db
			.select()
			.from(GameTable)
			.where(and(eq(GameTable.id, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (gameRow.length === 0) return null;

		// Validate eyesRe is between 0 and 240
		if (eyesRe < 0 || eyesRe > 240) {
			throw new Error('Augenzahl muss zwischen 0 und 240 liegen');
		}

		// Get next round number
		const roundCount = await db
			.select()
			.from(GameRoundTable)
			.where(eq(GameRoundTable.gameId, gameId));
		const nextRoundNumber = roundCount.length + 1;

		// Create round
		const [insertedRound] = await db
			.insert(GameRoundTable)
			.values({
				gameId,
				roundNumber: nextRoundNumber,
				type,
				soloType,
				eyesRe
			})
			.returning();

		const roundId = insertedRound.id;

		// Add participants with their teams
		for (const [playerId, team] of teamAssignments.entries()) {
			await db.insert(GameRoundParticipantTable).values({
				roundId,
				playerId,
				team
			});
		}

		// Fetch and return the created round
		return this.getRoundById(roundId);
	}

	async updateRound(
		roundId: string,
		gameId: string,
		groupId: string,
		type: RoundTypeEnum,
		soloType: SoloTypeEnumValue | null,
		eyesRe: number
	): Promise<GameRound | null> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return null;

		// Verify round belongs to game and game belongs to group
		const roundRow = await db
			.select()
			.from(GameRoundTable)
			.innerJoin(GameTable, eq(GameRoundTable.gameId, GameTable.id))
			.where(and(eq(GameRoundTable.id, roundId), eq(GameRoundTable.gameId, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (roundRow.length === 0) return null;

		// Validate eyesRe
		if (eyesRe < 0 || eyesRe > 240) {
			throw new Error('Augenzahl muss zwischen 0 und 240 liegen');
		}

		const [updated] = await db
			.update(GameRoundTable)
			.set({ type, soloType, eyesRe })
			.where(eq(GameRoundTable.id, roundId))
			.returning();

		return this.getRoundById(updated.id);
	}

	async updateRoundTeamAssignment(
		roundId: string,
		gameId: string,
		groupId: string,
		teamAssignments: Map<string, TeamEnumValue>
	): Promise<boolean> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return false;

		// Verify round belongs to game and game belongs to group
		const roundRow = await db
			.select()
			.from(GameRoundTable)
			.innerJoin(GameTable, eq(GameRoundTable.gameId, GameTable.id))
			.where(and(eq(GameRoundTable.id, roundId), eq(GameRoundTable.gameId, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (roundRow.length === 0) return false;

		// Delete existing assignments
		await db.delete(GameRoundParticipantTable).where(eq(GameRoundParticipantTable.roundId, roundId));

		// Add new assignments
		for (const [playerId, team] of teamAssignments.entries()) {
			await db.insert(GameRoundParticipantTable).values({
				roundId,
				playerId,
				team
			});
		}

		return true;
	}

	async deleteRound(roundId: string, gameId: string, groupId: string): Promise<boolean> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return false;

		// Verify round belongs to game and game belongs to group
		const roundRow = await db
			.select()
			.from(GameRoundTable)
			.innerJoin(GameTable, eq(GameRoundTable.gameId, GameTable.id))
			.where(and(eq(GameRoundTable.id, roundId), eq(GameRoundTable.gameId, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (roundRow.length === 0) return false;

		const result = await db.delete(GameRoundTable).where(eq(GameRoundTable.id, roundId)).returning();

		return result.length > 0;
	}

	async delete(id: string, groupId: string): Promise<boolean> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return false;

		const result = await db
			.delete(GameTable)
			.where(and(eq(GameTable.id, id), eq(GameTable.groupId, groupId)))
			.returning();

		return result.length > 0;
	}

	async addCall(roundId: string, gameId: string, groupId: string, playerId: string, callType: CallTypeEnumValue): Promise<boolean> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return false;

		// Verify round belongs to game and game belongs to group
		const roundRow = await db
			.select()
			.from(GameRoundTable)
			.innerJoin(GameTable, eq(GameRoundTable.gameId, GameTable.id))
			.where(and(eq(GameRoundTable.id, roundId), eq(GameRoundTable.gameId, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (roundRow.length === 0) return false;

		// Verify player is participant of the round
		const participantRow = await db
			.select()
			.from(GameRoundParticipantTable)
			.where(and(eq(GameRoundParticipantTable.roundId, roundId), eq(GameRoundParticipantTable.playerId, playerId)))
			.limit(1);

		if (participantRow.length === 0) return false;

		await db.insert(GameRoundCallTable).values({
			roundId,
			playerId,
			callType
		});

		return true;
	}

	async removeCall(roundId: string, gameId: string, groupId: string, playerId: string, callType: CallTypeEnumValue): Promise<boolean> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return false;

		// Verify round belongs to game and game belongs to group
		const roundRow = await db
			.select()
			.from(GameRoundTable)
			.innerJoin(GameTable, eq(GameRoundTable.gameId, GameTable.id))
			.where(and(eq(GameRoundTable.id, roundId), eq(GameRoundTable.gameId, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (roundRow.length === 0) return false;

		const result = await db
			.delete(GameRoundCallTable)
			.where(and(
				eq(GameRoundCallTable.roundId, roundId),
				eq(GameRoundCallTable.playerId, playerId),
				eq(GameRoundCallTable.callType, callType)
			))
			.returning();

		return result.length > 0;
	}

	async addBonus(roundId: string, gameId: string, groupId: string, playerId: string, bonusType: BonusTypeEnumValue, count: number): Promise<boolean> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return false;

		// Verify round belongs to game and game belongs to group
		const roundRow = await db
			.select()
			.from(GameRoundTable)
			.innerJoin(GameTable, eq(GameRoundTable.gameId, GameTable.id))
			.where(and(eq(GameRoundTable.id, roundId), eq(GameRoundTable.gameId, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (roundRow.length === 0) return false;

		// Verify player is participant of the round
		const participantRow = await db
			.select()
			.from(GameRoundParticipantTable)
			.where(and(eq(GameRoundParticipantTable.roundId, roundId), eq(GameRoundParticipantTable.playerId, playerId)))
			.limit(1);

		if (participantRow.length === 0) return false;

		// Validate count based on bonusType
		if (bonusType === 'FUCHS' && (count < 0 || count > 2)) {
			throw new Error('FUCHS: Anzahl muss zwischen 0 und 2 liegen');
		}
		if (bonusType === 'KARLCHEN' && (count < 0 || count > 1)) {
			throw new Error('KARLCHEN: Anzahl muss zwischen 0 und 1 liegen');
		}
		if (bonusType === 'DOKO' && count < 0) {
			throw new Error('DOKO: Anzahl muss mindestens 0 sein');
		}

		// Check if bonus already exists for this player and type
		const existingBonus = await db
			.select()
			.from(GameRoundBonusTable)
			.where(and(
				eq(GameRoundBonusTable.roundId, roundId),
				eq(GameRoundBonusTable.playerId, playerId),
				eq(GameRoundBonusTable.bonusType, bonusType)
			))
			.limit(1);

		if (existingBonus.length > 0) {
			// Update existing bonus
			await db
				.update(GameRoundBonusTable)
				.set({ count })
				.where(and(
					eq(GameRoundBonusTable.roundId, roundId),
					eq(GameRoundBonusTable.playerId, playerId),
					eq(GameRoundBonusTable.bonusType, bonusType)
				));
		} else {
			// Create new bonus
			await db.insert(GameRoundBonusTable).values({
				roundId,
				playerId,
				bonusType,
				count
			});
		}

		return true;
	}

	async removeBonus(roundId: string, gameId: string, groupId: string, playerId: string, bonusType: BonusTypeEnumValue): Promise<boolean> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return false;

		// Verify round belongs to game and game belongs to group
		const roundRow = await db
			.select()
			.from(GameRoundTable)
			.innerJoin(GameTable, eq(GameRoundTable.gameId, GameTable.id))
			.where(and(eq(GameRoundTable.id, roundId), eq(GameRoundTable.gameId, gameId), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (roundRow.length === 0) return false;

		const result = await db
			.delete(GameRoundBonusTable)
			.where(and(
				eq(GameRoundBonusTable.roundId, roundId),
				eq(GameRoundBonusTable.playerId, playerId),
				eq(GameRoundBonusTable.bonusType, bonusType)
			))
			.returning();

		return result.length > 0;
	}

	private async getRoundById(roundId: string): Promise<GameRound | null> {
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

	private async getRoundsForGame(gameId: string): Promise<GameRound[]> {
		const roundRows = await db
			.select()
			.from(GameRoundTable)
			.where(eq(GameRoundTable.gameId, gameId));

		const rounds: GameRound[] = [];
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

	private async getParticipantsForRound(roundId: string): Promise<GameRoundParticipant[]> {
		const rows = await db
			.select({
				participant: GameRoundParticipantTable,
				player: PlayerTable
			})
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

		return rows.map((row) => ({
			playerId: row.playerId,
			callType: row.callType
		}));
	}

	private async getBonusesForRoundPlayer(roundId: string, playerId: string): Promise<GameRoundBonus[]> {
		const rows = await db
			.select()
			.from(GameRoundBonusTable)
			.where(and(eq(GameRoundBonusTable.roundId, roundId), eq(GameRoundBonusTable.playerId, playerId)));

		return rows.map((row) => ({
			playerId: row.playerId,
			bonusType: row.bonusType,
			count: row.count
		}));
	}

	private async getParticipantsForGame(gameId: string): Promise<GameParticipant[]> {
		const rows = await db
			.select({
				participant: GameParticipantTable,
				player: PlayerTable
			})
			.from(GameParticipantTable)
			.innerJoin(PlayerTable, eq(GameParticipantTable.playerId, PlayerTable.id))
			.where(eq(GameParticipantTable.gameId, gameId));

		return rows
			.map((row) => ({
				playerId: row.participant.playerId,
				player: new Player(row.player as PlayerType),
				seatPosition: parseInt(row.participant.seatPosition)
			}))
			.sort((a, b) => a.seatPosition - b.seatPosition);
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
