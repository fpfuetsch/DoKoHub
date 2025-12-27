import { db } from '$lib/server/db';
import { GroupTable, GroupMemberTable, PlayerTable } from '$lib/server/db/schema';
import { Group } from '$lib/domain/group';
import { Player } from '$lib/domain/player';
import type { GroupType, GroupInsertType, PlayerType } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export class GroupRepository {
    async getById(id: string): Promise<Group | null> {
        const result = await db.select().from(GroupTable).where(eq(GroupTable.id, id)).limit(1);
        if (result.length === 0) return null;
        const groupData = result[0] as GroupType;
        const players = await this.getPlayersForGroup(groupData.id);
        return new Group(groupData, players);
    }

    async getAll(): Promise<Group[]> {
        const results = await db.select().from(GroupTable);
        const groups: Group[] = [];
        for (const groupData of results as GroupType[]) {
            const players = await this.getPlayersForGroup(groupData.id);
            groups.push(new Group(groupData, players));
        }
        return groups;
    }

    async create(data: GroupInsertType, playerIds: string[] = []): Promise<Group> {
        const [inserted] = await db.insert(GroupTable).values(data).returning();
        const groupInstance = new Group(inserted as GroupType);
        // Optionally add players to group
        for (const playerId of playerIds) {
            await db.insert(GroupMemberTable).values({ groupId: groupInstance.id, playerId });
        }
        groupInstance.players = await this.getPlayersForGroup(groupInstance.id);
        return groupInstance;
    }

    async delete(id: string): Promise<boolean> {
        const result = await db.delete(GroupTable).where(eq(GroupTable.id, id)).returning();
        return result.length > 0;
    }

    private async getPlayersForGroup(groupId: string): Promise<Player[]> {
        const rows = await db
            .select({
                player: PlayerTable
            })
            .from(GroupMemberTable)
            .innerJoin(PlayerTable, eq(GroupMemberTable.playerId, PlayerTable.id))
            .where(eq(GroupMemberTable.groupId, groupId));
        return rows.map(row => new Player(row.player as PlayerType));
    }
}
