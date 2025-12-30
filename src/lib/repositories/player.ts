import { db } from '$lib/server/db';
import { PlayerTable, type AuthProviderType } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { Player } from '$lib/domain/player';
import type { PlayerType } from '$lib/server/db/schema';

export class PlayerRepository {
	async getById(id: string): Promise<Player | null> {
		const result = await db.select().from(PlayerTable).where(eq(PlayerTable.id, id)).limit(1);
		if (result.length === 0) return null;
		return new Player(result[0] as PlayerType);
	}

	async getAll(): Promise<Player[]> {
		const results = await db.select().from(PlayerTable);
		return results.map((row) => new Player(row as PlayerType));
	}

	async getByName(name: string): Promise<Player | null> {
		const result = await db.select().from(PlayerTable).where(eq(PlayerTable.name, name)).limit(1);
		if (result.length === 0) return null;
		return new Player(result[0] as PlayerType);
	}

	async getByProvider(provider: AuthProviderType, providerId: string): Promise<Player | null> {
		const result = await db
			.select()
			.from(PlayerTable)
			.where(and(eq(PlayerTable.authProviderId, providerId), eq(PlayerTable.authProvider, provider)))
			.limit(1);
		if (result.length === 0) return null;
		return new Player(result[0] as PlayerType);
	}

	async create(data: Omit<PlayerType, 'id' | 'createdAt'>): Promise<Player> {
		const [inserted] = await db.insert(PlayerTable).values(data).returning();
		return new Player(inserted as PlayerType);
	}

	async update(
		id: string,
		data: Partial<Omit<PlayerType, 'id' | 'createdAt'>>
	): Promise<Player | null> {
		const [updated] = await db.update(PlayerTable).set(data).where(eq(PlayerTable.id, id)).returning();
		return updated ? new Player(updated as PlayerType) : null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await db.delete(PlayerTable).where(eq(PlayerTable.id, id)).returning();
		return result.length > 0;
	}
}
