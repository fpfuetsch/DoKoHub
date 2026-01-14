import { db } from '$lib/server/db';
import { GroupMemberTable, GroupTable } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { type RepoVoidResult, ok, err } from './result';

export class BaseRepository {
	protected getPrincipalId(): string | undefined {
		return undefined;
	}

	protected requirePrincipal(): RepoVoidResult {
		if (!this.getPrincipalId()) return err('Unauthorized', 401);
		return ok();
	}

    protected async isGroupMember(groupId: string, playerId: string): Promise<boolean> {
        const result = await db
            .select({})
            .from(GroupMemberTable)
            .where(and(eq(GroupMemberTable.groupId, groupId), eq(GroupMemberTable.playerId, playerId)))
            .limit(1);
        return result.length > 0;
    }

	protected async ensureGroupMembership(groupId: string): Promise<RepoVoidResult> {
		const principalCheck = this.requirePrincipal();
		if (!principalCheck.ok) return principalCheck;
		const authorized = await this.isGroupMember(groupId, this.getPrincipalId()!);
		if (!authorized) return err('Forbidden', 403);
		return ok();
	}


	protected async groupExists(groupId: string): Promise<RepoVoidResult> {
		const result = await db
			.select({ id: GroupTable.id })
			.from(GroupTable)
			.where(eq(GroupTable.id, groupId))
			.limit(1);
		if (result.length === 0) return err('Gruppe nicht gefunden.', 404);
		return ok();
	}
}
