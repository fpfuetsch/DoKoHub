import { db } from '$lib/server/db';
import { player } from '$lib/server/db/schema';
import { Player } from '$lib/domain/player';
import type { Player as PlayerType } from '$lib/types/db';

export class PlayerRepository {
	async getById(id: string): Promise<Player | null> {
		const result = await db.select().from(player).where(player.id.eq(id)).limit(1);
		if (result.length === 0) return null;
		return new Player(result[0] as PlayerType);
	}

	async getAll(): Promise<Player[]> {
		const results = await db.select().from(player);
		return results.map((row) => new Player(row as PlayerType));
	}

	async create(data: Omit<PlayerType, 'id' | 'createdAt'>): Promise<Player> {
		const [inserted] = await db.insert(player).values(data).returning();
		return new Player(inserted as PlayerType);
	}

	async update(
		id: string,
		data: Partial<Omit<PlayerType, 'id' | 'createdAt'>>
	): Promise<Player | null> {
		const [updated] = await db.update(player).set(data).where(player.id.eq(id)).returning();
		return updated ? new Player(updated as PlayerType) : null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await db.delete(player).where(player.id.eq(id)).returning();
		return result.length > 0;
	}
}
