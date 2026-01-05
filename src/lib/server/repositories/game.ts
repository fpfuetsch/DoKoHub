import { RoundRepository } from '$lib/server/repositories/round';
import { db } from '$lib/server/db';
import {
	GameTable,
	GameParticipantTable,
	PlayerTable,
	GroupMemberTable
} from '$lib/server/db/schema';
import { Game, type GameParticipant } from '$lib/domain/game';
import { Player } from '$lib/domain/player';
import type { GameType, PlayerType } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';

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
		const roundRepo = new RoundRepository(this.principalId);
		const rounds = await roundRepo.getRoundsForGame(gameData.id, groupId);
		return new Game(gameData, participants, rounds);
	}

	async listByGroup(groupId: string): Promise<Game[]> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId);
		if (!isMember) return [];

		const gameRows = await db
			.select()
			.from(GameTable)
			.where(eq(GameTable.groupId, groupId))
			.orderBy(desc(GameTable.createdAt));

		const games: Game[] = [];
		for (const gameRow of gameRows) {
			const gameData = gameRow as GameType;
			const participants = await this.getParticipantsForGame(gameData.id);
			// Do not load rounds here to keep list view fast; rounds are fetched on game detail
			games.push(new Game(gameData, participants, []));
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
		const validRoundCounts = [8, 12, 16, 20, 24];
		if (!validRoundCounts.includes(maxRoundCount)) {
			throw new Error('Gültige Rundenanzahlen sind: 8, 12, 16, 20, 24');
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
				seatPosition: Number(i)
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
		const roundRepo = new RoundRepository(this.principalId);
		const rounds = await roundRepo.getRoundsForGame(updated.id, groupId);
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
			seatPosition
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
			.where(
				and(eq(GameParticipantTable.gameId, gameId), eq(GameParticipantTable.playerId, playerId))
			)
			.returning();

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
				seatPosition: row.participant.seatPosition
			}))
			.sort((a, b) => a.seatPosition - b.seatPosition);
	}

	private async isGroupMember(groupId: string): Promise<boolean> {
		const result = await db
			.select({})
			.from(GroupMemberTable)
			.where(
				and(eq(GroupMemberTable.groupId, groupId), eq(GroupMemberTable.playerId, this.principalId))
			)
			.limit(1);
		return result.length > 0;
	}
}
