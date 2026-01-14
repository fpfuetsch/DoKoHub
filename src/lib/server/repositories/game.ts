import { RoundRepository } from '$lib/server/repositories/round';
import { type RepoResult, type RepoVoidResult, ok, err } from '$lib/server/repositories/result';
import { BaseRepository } from '$lib/server/repositories/base';
import { db } from '$lib/server/db';
import {
	GameTable,
	GameParticipantTable,
	PlayerTable
} from '$lib/server/db/schema';
import { Game, type GameParticipant } from '$lib/domain/game';
import { Player } from '$lib/domain/player';
import type { GameType, PlayerType } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';

export class GameRepository extends BaseRepository {
	private readonly principalId: string;

	constructor(principalId: string) {
		super();
		this.principalId = principalId;
	}

	protected getPrincipalId(): string | undefined {
		return this.principalId;
	}

	async getById(id: string, groupId: string): Promise<RepoResult<Game>> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId, this.principalId);
		if (!isMember) return err('Forbidden', 403);

		const gameRow = await db
			.select()
			.from(GameTable)
			.where(and(eq(GameTable.id, id), eq(GameTable.groupId, groupId)))
			.limit(1);

		if (gameRow.length === 0) return err('Spiel nicht gefunden.', 404);

		const gameData = gameRow[0] as GameType;
		const participants = await this.getParticipantsForGame(gameData.id);
		const roundRepo = new RoundRepository(this.principalId);
		const roundsResult = await roundRepo.getRoundsForGame(gameData.id, groupId);
		if (!roundsResult.ok) return err(roundsResult.error, roundsResult.status);
		return ok(new Game(gameData, participants, roundsResult.value));
	}

	async listByGroup(groupId: string): Promise<RepoResult<Game[]>> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId, this.principalId);
		if (!isMember) return err('Forbidden', 403);

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
		return ok(games);
	}

	async create(
		groupId: string,
		maxRoundCount: number,
		withMandatorySolos: boolean,
		participantIds: string[] = []
	): Promise<RepoResult<Game>> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId, this.principalId);
		if (!isMember) return err('Forbidden', 403);

		// Create draft game to validate
		const draftGame = new Game(
			{
				id: 'draft',
				groupId,
				maxRoundCount,
				withMandatorySolos,
				createdAt: new Date(),
				endedAt: null
			},
			// Add draft participants with seat positions
			participantIds.map((playerId, seatPosition) => ({
				playerId,
				player: null as any,
				seatPosition
			})),
			[]
		);

		// Validate the draft game
		const validationError = Game.validate(draftGame);
		if (validationError) {
			return err(validationError);
		}

		// Persist to database
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
		return ok(gameInstance);
	}

	async finish(id: string, groupId: string, endedAt: Date): Promise<RepoResult<Game>> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId, this.principalId);
		if (!isMember) return err('Forbidden', 403);

		// Load current game state for validation
		const existingResult = await this.getById(id, groupId);
		if (!existingResult.ok) return existingResult;
		const existing = existingResult.value;

		if (existing.isFinished()) {
			return err('Spiel ist bereits beendet.');
		}

		const gameValidationError = Game.validate(existing);
		if (gameValidationError) {
			return err(gameValidationError);
		}

		const [updated] = await db
			.update(GameTable)
			.set({ endedAt })
			.where(and(eq(GameTable.id, id), eq(GameTable.groupId, groupId)))
			.returning();

		if (!updated) return err('Spiel konnte nicht beendet werden.', 404);

		const participants = await this.getParticipantsForGame(updated.id);
		const roundRepo = new RoundRepository(this.principalId);
		const roundsResult = await roundRepo.getRoundsForGame(updated.id, groupId);
		if (!roundsResult.ok) return err(roundsResult.error, roundsResult.status);
		return ok(new Game(updated as GameType, participants, roundsResult.value));
	}

	async delete(id: string, groupId: string): Promise<RepoVoidResult> {
		// Verify user is member of the group
		const isMember = await this.isGroupMember(groupId, this.principalId);
		if (!isMember) return err('Forbidden', 403);

		const result = await db
			.delete(GameTable)
			.where(and(eq(GameTable.id, id), eq(GameTable.groupId, groupId)))
			.returning();

		if (result.length === 0) return err('Spiel konnte nicht gelöscht werden.', 404);
		return ok();
	}

	protected async getParticipantsForGame(gameId: string): Promise<GameParticipant[]> {
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
}
