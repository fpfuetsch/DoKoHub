import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';

export const PlayerTable = pgTable('players', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	email: text('email').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});
export type PlayerType = InferSelectModel<typeof PlayerTable>;

export const GroupTable = pgTable('group', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});
export type GroupType = InferSelectModel<typeof GroupTable>;
export type GroupInsertType = InferInsertModel<typeof GroupTable>;
export const GroupInsertSchema = createInsertSchema(GroupTable);

export const GroupMemberTable = pgTable('group_member', {
	groupId: uuid('group_id').references(() => GroupTable.id, { onDelete: 'cascade' }),
	playerId: uuid('player_id').references(() => PlayerTable.id, { onDelete: 'cascade' })
});
export type GroupMemberType = InferSelectModel<typeof GroupMemberTable>;