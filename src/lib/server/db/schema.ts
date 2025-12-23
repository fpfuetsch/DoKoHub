import { pgTable, uuid, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const player = pgTable('players', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	email: text('email').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const group = pgTable('group', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: varchar('name', { length: 255 }),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const groupMember = pgTable('group_member', {
	groupId: uuid('group_id').references(() => group.id, { onDelete: 'cascade' }),
	playerId: uuid('player_id').references(() => player.id, { onDelete: 'cascade' })
});
