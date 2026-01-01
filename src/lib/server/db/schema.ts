import { pgTable, uuid, text, timestamp, pgEnum, integer, boolean } from 'drizzle-orm/pg-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const AuthProviderEnum = pgEnum('auth_provider', ['local', 'google', 'apple']);
export type AuthProviderType = 'local' | 'google' | 'apple';

export const RoundTypeEnum = pgEnum('round_type', [
	'NORMAL',
	'HOCHZEIT_NORMAL',
	'HOCHZEIT_STILL',
	'HOCHZEIT_UNGEKLAERT',
	'SOLO_DAMEN',
	'SOLO_BUBEN',
	'SOLO_KREUZ',
	'SOLO_PIK',
	'SOLO_HERZ',
	'SOLO_KARO',
	'SOLO_ASS'
]);
export type RoundTypeEnum = 'NORMAL' | 'HOCHZEIT_NORMAL' | 'HOCHZEIT_STILL' | 'HOCHZEIT_UNGEKLAERT' | 'SOLO_DAMEN' | 'SOLO_BUBEN' | 'SOLO_KREUZ' | 'SOLO_PIK' | 'SOLO_HERZ' | 'SOLO_KARO' | 'SOLO_ASS';

export const SoloTypeEnum = pgEnum('solo_type', ['PFLICHT', 'LUST']);
export type SoloTypeEnumValue = 'PFLICHT' | 'LUST';

export const TeamEnum = pgEnum('team', ['RE', 'KONTRA']);
export type TeamEnumValue = 'RE' | 'KONTRA';

export const CallTypeEnum = pgEnum('call_type', ['RE', 'KONTRA', 'KEINE90', 'KEINE60', 'KEINE30', 'SCHWARZ']);
export type CallTypeEnumValue = 'RE' | 'KONTRA' | 'KEINE90' | 'KEINE60' | 'KEINE30' | 'SCHWARZ';

export const BonusTypeEnum = pgEnum('bonus_type', ['DOKO', 'FUCHS', 'KARLCHEN']);
export type BonusTypeEnumValue = 'DOKO' | 'FUCHS' | 'KARLCHEN';

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
	.max(50, 'Maximal 50 Zeichen erlaubt');

export const PlayerProfileSchema = z.object({
	displayName: PlayerDisplayNameSchema,
	name: PlayerNameSchema
});

export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

export const GroupNameSchema = z
	.string()
	.trim()
	.regex(/^[A-Za-zÄÖÜäöüß0-9_\- ]+$/, 'Buchstaben (inkl. Umlaute), Zahlen, -, _ und Leerzeichen sind erlaubt')
	.min(3, 'Mindestens 3 Zeichen notwendig')
	.max(50, 'Maximal 50 Zeichen erlaubt');

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

export const GameTable = pgTable('game', {
	id: uuid('id').primaryKey().defaultRandom(),
	groupId: uuid('group_id').notNull().references(() => GroupTable.id, { onDelete: 'cascade' }),
	maxRoundCount: integer('max_round_count').notNull(), // 4, 8, 12, 16, 20, 24
	withMandatorySolos: boolean('with_mandatory_solos').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	endedAt: timestamp('ended_at')
});
export type GameType = InferSelectModel<typeof GameTable>;
export type GameInsertType = InferInsertModel<typeof GameTable>;

export const GameRoundTable = pgTable('game_round', {
	id: uuid('id').primaryKey().defaultRandom(),
	gameId: uuid('game_id').notNull().references(() => GameTable.id, { onDelete: 'cascade' }),
	roundNumber: integer('round_number').notNull(),
	type: RoundTypeEnum('type').notNull(),
	soloType: SoloTypeEnum('solo_type'), // optional
	eyesRe: integer('eyes_re').notNull() // 0-240
});
export type GameRoundType = InferSelectModel<typeof GameRoundTable>;
export type GameRoundInsertType = InferInsertModel<typeof GameRoundTable>;

export const GameRoundParticipantTable = pgTable('game_round_participant', {
	id: uuid('id').primaryKey().defaultRandom(),
	roundId: uuid('round_id').notNull().references(() => GameRoundTable.id, { onDelete: 'cascade' }),
	playerId: uuid('player_id').notNull().references(() => PlayerTable.id, { onDelete: 'cascade' }),
	team: TeamEnum('team').notNull() // RE oder KONTRA
});
export type GameRoundParticipantType = InferSelectModel<typeof GameRoundParticipantTable>;
export type GameRoundParticipantInsertType = InferInsertModel<typeof GameRoundParticipantTable>;

export const GameParticipantTable = pgTable('game_participant', {
	id: uuid('id').primaryKey().defaultRandom(),
	gameId: uuid('game_id').notNull().references(() => GameTable.id, { onDelete: 'cascade' }),
	playerId: uuid('player_id').notNull().references(() => PlayerTable.id, { onDelete: 'cascade' }),
	seatPosition: integer('seat_position').notNull() // Position in der Sitzreihenfolge (0-3)
});
export type GameParticipantType = InferSelectModel<typeof GameParticipantTable>;
export type GameParticipantInsertType = InferInsertModel<typeof GameParticipantTable>;

export const GameRoundCallTable = pgTable('game_round_call', {
	id: uuid('id').primaryKey().defaultRandom(),
	roundId: uuid('round_id').notNull().references(() => GameRoundTable.id, { onDelete: 'cascade' }),
	playerId: uuid('player_id').notNull().references(() => PlayerTable.id, { onDelete: 'cascade' }),
	callType: CallTypeEnum('call_type').notNull()
});
export type GameRoundCallType = InferSelectModel<typeof GameRoundCallTable>;
export type GameRoundCallInsertType = InferInsertModel<typeof GameRoundCallTable>;

export const GameRoundBonusTable = pgTable('game_round_bonus', {
	id: uuid('id').primaryKey().defaultRandom(),
	roundId: uuid('round_id').notNull().references(() => GameRoundTable.id, { onDelete: 'cascade' }),
	playerId: uuid('player_id').notNull().references(() => PlayerTable.id, { onDelete: 'cascade' }),
	bonusType: BonusTypeEnum('bonus_type').notNull(),
	count: integer('count').notNull().default(0) // Anzahl der Bonus-Punkte
});
export type GameRoundBonusType = InferSelectModel<typeof GameRoundBonusTable>;
export type GameRoundBonusInsertType = InferInsertModel<typeof GameRoundBonusTable>;