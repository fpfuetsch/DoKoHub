import { db } from '$lib/server/db';
import { GroupTable, GroupMemberTable, PlayerTable } from '$lib/server/db/schema';
import { Group } from '$lib/domain/group';
import { Player } from '$lib/domain/player';
import type { GroupType, GroupInsertType, PlayerType } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export class GroupRepository {
	constructor(private readonly principalId: string) {}

	async getById(id: string): Promise<Group | null> {
		const row = await db
			.select({ group: GroupTable })
			.from(GroupTable)
			.innerJoin(GroupMemberTable, eq(GroupMemberTable.groupId, GroupTable.id))
			.where(and(eq(GroupTable.id, id), eq(GroupMemberTable.playerId, this.principalId)))
			.limit(1);
		if (row.length === 0) return null;
		const groupData = row[0].group as GroupType;
		const players = await this.getPlayersForGroup(groupData.id);
		return new Group(groupData, players);
	}

	async list(): Promise<Group[]> {
		const rows = await db
			.select({ group: GroupTable })
			.from(GroupMemberTable)
			.innerJoin(GroupTable, eq(GroupMemberTable.groupId, GroupTable.id))
			.where(eq(GroupMemberTable.playerId, this.principalId));

		const groups: Group[] = [];
		for (const row of rows) {
			const groupData = row.group as GroupType;
			const players = await this.getPlayersForGroup(groupData.id);
			groups.push(new Group(groupData, players));
		}
		return groups;
	}

	async create(data: GroupInsertType, memberIds: string[] = []): Promise<Group> {
		const [inserted] = await db.insert(GroupTable).values(data).returning();
		const groupInstance = new Group(inserted as GroupType);

		const uniqueMemberIds = new Set([this.principalId, ...memberIds]);
		for (const playerId of uniqueMemberIds) {
			await db.insert(GroupMemberTable).values({ groupId: groupInstance.id, playerId });
		}

		groupInstance.players = await this.getPlayersForGroup(groupInstance.id);
		return groupInstance;
	}

	async delete(id: string): Promise<boolean> {
		const authorized = await this.isMember(id);
		if (!authorized) return false;
		const result = await db.delete(GroupTable).where(eq(GroupTable.id, id)).returning();
		return result.length > 0;
	}

	async updateName(id: string, name: string): Promise<boolean> {
		const authorized = await this.isMember(id);
		if (!authorized) return false;
		const result = await db
			.update(GroupTable)
			.set({ name })
			.where(eq(GroupTable.id, id))
			.returning();
		return result.length > 0;
	}

	async addMember(groupId: string, playerId: string, usingInvitation: boolean = false): Promise<boolean> {
		const authorized = await this.isMember(groupId);
		if (!usingInvitation && !authorized) return false;
		const isAlreadyMember = await this.isMember(groupId);
		if (isAlreadyMember) return true;
		await db.insert(GroupMemberTable).values({ groupId, playerId });
		return true;
	}

	async removeMember(groupId: string, playerId: string): Promise<boolean> {
		const authorized = await this.isMember(groupId);
		if (!authorized) return false;
		const result = await db
			.delete(GroupMemberTable)
			.where(and(eq(GroupMemberTable.groupId, groupId), eq(GroupMemberTable.playerId, playerId)))
			.returning();
		return result.length > 0;
	}

	private async isMember(groupId: string): Promise<boolean> {
		const result = await db
			.select({})
			.from(GroupMemberTable)
			.where(
				and(eq(GroupMemberTable.groupId, groupId), eq(GroupMemberTable.playerId, this.principalId))
			)
			.limit(1);
		return result.length > 0;
	}

	private async getPlayersForGroup(groupId: string): Promise<Player[]> {
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
