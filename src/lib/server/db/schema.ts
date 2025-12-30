import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const AuthProviderEnum = pgEnum('auth_provider', ['local', 'google', 'apple']);
export type AuthProviderType = 'local' | 'google' | 'apple';

export const PlayerTable = pgTable('players', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull().unique(),
	displayName: text('display_name').notNull(),
	authProvider: AuthProviderEnum('auth_provider').notNull().default('local'),
	authProviderId: text('auth_provider_id'),
	createdAt: timestamp('created_at').notNull().defaultNow()

});
export type PlayerType = InferSelectModel<typeof PlayerTable>;
export type PlayerInsertType = InferInsertModel<typeof PlayerTable>;

export const PlayerNameSchema = z
	.string()
	.trim()
	.regex(/^[a-z0-9_-]+$/, 'Nur Kleinbuchstaben, Zahlen, - und _ sind erlaubt')
	.min(3, 'Mindestens 3 Zeichen notwendig')
	.max(40, 'Maximal 30 Zeichen erlaubt');

export const PlayerDisplayNameSchema = z
	.string()
	.trim()
	.min(3, 'Mindestens 3 Zeichen notwendig')
	.max(80, 'Maximal 50 Zeichen erlaubt');

export const PlayerProfileSchema = z.object({
	displayName: PlayerDisplayNameSchema,
	name: PlayerNameSchema
});

export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

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