import { db } from '$lib/server/db';
import { group, groupMember, player } from '$lib/server/db/schema';
import { Group } from '$lib/domain/group';
import { Player } from '$lib/domain/player';
import type { Group as GroupType, Player as PlayerType } from '$lib/types/db';
import { eq } from 'drizzle-orm';

export class GroupRepository {
	async getById(id: string): Promise<Group | null> {
		const result = await db.select().from(group).where(eq(group.id, id)).limit(1);
		if (result.length === 0) return null;
		const groupData = result[0] as GroupType;
		const players = await this.getPlayersForGroup(groupData.id);
		return new Group(groupData.id, groupData.name, groupData.createdAt, players);
	}

	async getAll(): Promise<Group[]> {
		const results = await db.select().from(group);
		const groups: Group[] = [];
		for (const g of results as GroupType[]) {
			const players = await this.getPlayersForGroup(g.id);
			groups.push(new Group(g.id, g.name, g.createdAt, players));
		}
		return groups;
	}

	async create(
		data: Omit<GroupType, 'id' | 'createdAt'>,
		playerIds: string[] = []
	): Promise<Group> {
		const [inserted] = await db.insert(group).values(data).returning();
		const groupData = inserted as GroupType;
		// Optionally add players to group
		for (const playerId of playerIds) {
			await db.insert(groupMember).values({ groupId: groupData.id, playerId });
		}
		const players = await this.getPlayersForGroup(groupData.id);
		return new Group(groupData.id, groupData.name, groupData.createdAt, players);
	}

	async update(
		id: string,
		data: Partial<Omit<GroupType, 'id' | 'createdAt'>>
	): Promise<Group | null> {
		const [updated] = await db.update(group).set(data).where(eq(group.id, id)).returning();
		if (!updated) return null;
		const groupData = updated as GroupType;
		const players = await this.getPlayersForGroup(groupData.id);
		return new Group(groupData.id, groupData.name, groupData.createdAt, players);
	}

	async delete(id: string): Promise<boolean> {
		const result = await db.delete(group).where(eq(group.id, id)).returning();
		return result.length > 0;
	}

	private async getPlayersForGroup(groupId: string): Promise<Player[]> {
		const rows = await db
			.select({
				player: player
			})
			.from(groupMember)
			.innerJoin(player, eq(groupMember.playerId, player.id))
			.where(eq(groupMember.groupId, groupId));
		return rows.map((row) => new Player(row.player as PlayerType));
	}
}
