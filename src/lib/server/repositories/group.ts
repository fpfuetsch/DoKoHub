import { db } from '$lib/server/db';
import {
	GroupTable,
	GroupMemberTable,
	PlayerTable,
	GroupNameSchema,
	GameTable
} from '$lib/server/db/schema';
import { Group } from '$lib/domain/group';
import { Player } from '$lib/domain/player';
import { BaseRepository } from '$lib/server/repositories/base';
import type { GroupType, PlayerType } from '$lib/server/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { err, ok, type RepoResult, type RepoVoidResult } from './result';
import { PlayerRepository } from '$lib/server/repositories/player';
import { AuthProvider } from '$lib/server/enums';

export class GroupRepository extends BaseRepository {
	private readonly principalId: string;

	constructor(principalId: string) {
		super();
		this.principalId = principalId;
	}

	protected getPrincipalId(): string | undefined {
		return this.principalId;
	}

	async getById(id: string): Promise<RepoResult<Group>> {
		const row = await db
			.select({ group: GroupTable })
			.from(GroupTable)
			.innerJoin(GroupMemberTable, eq(GroupMemberTable.groupId, GroupTable.id))
			.where(and(eq(GroupTable.id, id), eq(GroupMemberTable.playerId, this.principalId)))
			.limit(1);
		if (row.length === 0) return err('Gruppe nicht gefunden oder keine Berechtigung.', 404);
		const groupData = row[0].group as GroupType;
		const players = await this.getMembers(groupData.id);
		return ok(new Group(groupData, players));
	}

	async list(): Promise<Group[]> {
		const rows = await db
			.select({ group: GroupTable })
			.from(GroupMemberTable)
			.innerJoin(GroupTable, eq(GroupMemberTable.groupId, GroupTable.id))
			.leftJoin(GameTable, eq(GameTable.groupId, GroupTable.id))
			.where(eq(GroupMemberTable.playerId, this.principalId))
			.groupBy(GroupTable.id)
			.orderBy(sql`max(${GameTable.createdAt}) desc nulls last`, desc(GroupTable.createdAt));

		const groups: Group[] = [];
		for (const row of rows) {
			const groupData = row.group as GroupType;
			const players = await this.getMembers(groupData.id);
			groups.push(new Group(groupData, players));
		}
		return groups;
	}

	async create(name: string, memberIds: string[] = []): Promise<RepoResult<Group>> {
		const validationResult = this.validateGroupName(name);
		if (!validationResult.ok) return validationResult as RepoResult<Group>;

		const [inserted] = await db
			.insert(GroupTable)
			.values({ name: validationResult.value })
			.returning();
		const groupInstance = new Group(inserted as GroupType);

		const uniqueMemberIds = new Set([this.principalId, ...memberIds]);
		for (const playerId of uniqueMemberIds) {
			await db.insert(GroupMemberTable).values({ groupId: groupInstance.id, playerId });
		}

		groupInstance.players = await this.getMembers(groupInstance.id);
		return ok(groupInstance);
	}

	async delete(id: string): Promise<RepoVoidResult> {
		const membershipCheck = await this.ensureGroupMembership(id);
		if (!membershipCheck.ok) return membershipCheck;

		// Find all local players in this group
		const localPlayersInGroup = await db
			.select()
			.from(GroupMemberTable)
			.innerJoin(PlayerTable, eq(GroupMemberTable.playerId, PlayerTable.id))
			.where(
				and(eq(GroupMemberTable.groupId, id), eq(PlayerTable.authProvider, AuthProvider.Local))
			);

		// Delete local players using PlayerRepository
		const playerRepo = new PlayerRepository(this.principalId);
		for (const row of localPlayersInGroup) {
			const playerId = (row.group_member as any).playerId as string;
			const deleteResult = await playerRepo.deleteLocal(playerId, id, false);
			if (!deleteResult.ok) return deleteResult;
		}

		const result = await db.delete(GroupTable).where(eq(GroupTable.id, id)).returning();
		if (result.length === 0) return err('Gruppe konnte nicht gelöscht werden.', 404);
		return ok();
	}

	async rename(id: string, name: string): Promise<RepoVoidResult> {
		const membershipCheck = await this.ensureGroupMembership(id);
		if (!membershipCheck.ok) return membershipCheck;

		const validationResult = this.validateGroupName(name);
		if (!validationResult.ok) return validationResult;

		const result = await db
			.update(GroupTable)
			.set({ name: validationResult.value })
			.where(eq(GroupTable.id, id))
			.returning();
		if (result.length === 0) return err('Gruppe konnte nicht aktualisiert werden.', 404);
		return ok();
	}

	async addMember(
		groupId: string,
		playerId: string,
		usingInvitation: boolean = false
	): Promise<RepoVoidResult> {
		if (!usingInvitation) {
			const membershipCheck = await this.ensureGroupMembership(groupId);
			if (!membershipCheck.ok) return membershipCheck;
		} else {
			const exists = await this.groupExists(groupId);
			if (!exists.ok) return exists;
		}

		const isAlreadyMember = await this.isGroupMember(groupId, playerId);
		if (isAlreadyMember) return ok();

		await db.insert(GroupMemberTable).values({ groupId, playerId });
		return ok();
	}

	async leave(groupId: string): Promise<RepoResult<{ deletedGroup: boolean }>> {
		const groupResult = await this.getById(groupId);
		if (!groupResult.ok) return groupResult;
		const group = groupResult.value;

		const nonLocalPlayers = group.players.filter((p) => p.authProvider !== AuthProvider.Local);
		const isLastNonLocalPlayer = nonLocalPlayers.length === 1;

		if (isLastNonLocalPlayer) {
			// Delete the group (which will also delete all local players)
			const deleted = await this.delete(groupId);
			if (!deleted.ok) return deleted;
			return ok({ deletedGroup: true });
		}

		return this.removeMember(groupId, this.principalId);
	}

	private validateGroupName(name: string): RepoResult<string> {
		const parsed = GroupNameSchema.safeParse(name);
		if (!parsed.success) {
			return err(parsed.error.issues[0]?.message || 'Bitte einen gültigen Gruppennamen eingeben.');
		}
		return ok(parsed.data);
	}

	private async removeMember(
		groupId: string,
		playerId: string
	): Promise<RepoResult<{ deletedGroup: boolean }>> {
		const result = await db
			.delete(GroupMemberTable)
			.where(and(eq(GroupMemberTable.groupId, groupId), eq(GroupMemberTable.playerId, playerId)))
			.returning();
		if (result.length === 0) return err('Mitglied konnte nicht entfernt werden.', 400);
		return ok({ deletedGroup: false });
	}

	private async getMembers(groupId: string): Promise<Player[]> {
		const rows = await db
			.select({
				player: PlayerTable
			})
			.from(GroupMemberTable)
			.innerJoin(PlayerTable, eq(GroupMemberTable.playerId, PlayerTable.id))
			.where(eq(GroupMemberTable.groupId, groupId))
			.orderBy(PlayerTable.displayName);
		return rows.map((row) => new Player(row.player as PlayerType));
	}
}
