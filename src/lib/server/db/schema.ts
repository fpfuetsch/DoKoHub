import { pgTable, uuid, text, timestamp, pgEnum, integer, boolean } from 'drizzle-orm/pg-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
	AuthProvider,
	RoundType,
	SoloType,
	Team,
	RoundResult,
	CallType,
	BonusType
} from '../enums';
import type { RoundTypeEnum, SoloTypeEnumValue, TeamEnumValue } from '../enums';

// Database enums for Drizzle (derived from TypeScript enums)
export const AuthProviderDbEnum = pgEnum(
	'auth_provider',
	Object.values(AuthProvider) as [AuthProvider, ...AuthProvider[]]
);
export const RoundTypeDbEnum = pgEnum(
	'round_type',
	Object.values(RoundType) as [RoundType, ...RoundType[]]
);
export const SoloTypeDbEnum = pgEnum(
	'solo_type',
	Object.values(SoloType) as [SoloType, ...SoloType[]]
);
export const TeamDbEnum = pgEnum('team', Object.values(Team) as [Team, ...Team[]]);
export const CallTypeDbEnum = pgEnum(
	'call_type',
	Object.values(CallType) as [CallType, ...CallType[]]
);
export const BonusTypeDbEnum = pgEnum(
	'bonus_type',
	Object.values(BonusType) as [BonusType, ...BonusType[]]
);
export const RoundResultDbEnum = pgEnum(
	'round_result',
	Object.values(RoundResult) as [RoundResult, ...RoundResult[]]
);

export const PlayerTable = pgTable('players', {
	id: uuid('id').primaryKey().defaultRandom(),
	displayName: text('display_name').notNull(),
	authProvider: AuthProviderDbEnum('auth_provider').notNull().default(AuthProvider.Local),
	authProviderId: text('auth_provider_id'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});
export type PlayerType = InferSelectModel<typeof PlayerTable>;
export type PlayerInsertType = InferInsertModel<typeof PlayerTable>;

export const PlayerDisplayNameSchema = z
	.string()
	.trim()
	.min(3, 'Mindestens 3 Zeichen notwendig')
	.max(50, 'Maximal 50 Zeichen erlaubt');

export const PlayerProfileSchema = z.object({
	displayName: PlayerDisplayNameSchema
});

export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

export const GroupNameSchema = z
	.string()
	.trim()
	.regex(
		/^[A-Za-zÄÖÜäöüß0-9_\- ]+$/,
		'Buchstaben (inkl. Umlaute), Zahlen, -, _ und Leerzeichen sind erlaubt'
	)
	.min(3, 'Mindestens 3 Zeichen notwendig')
	.max(50, 'Maximal 50 Zeichen erlaubt');

export const CreateGameSchema = z.object({
	maxRoundCount: z.coerce
		.number()
		.int()
		.refine((val) => [8, 12, 16, 20, 24].includes(val), {
			message: 'Bitte wähle eine gültige Rundenanzahl (8, 12, 16, 20 oder 24)'
		}),
	withMandatorySolos: z.coerce.boolean(),
	player_0: z
		.string()
		.min(1, 'Bitte wähle einen Spieler für Sitzposition 1')
		.uuid('Ungültige Spieler-ID für Sitzposition 1'),
	player_1: z
		.string()
		.min(1, 'Bitte wähle einen Spieler für Sitzposition 2')
		.uuid('Ungültige Spieler-ID für Sitzposition 2'),
	player_2: z
		.string()
		.min(1, 'Bitte wähle einen Spieler für Sitzposition 3')
		.uuid('Ungültige Spieler-ID für Sitzposition 3'),
	player_3: z
		.string()
		.min(1, 'Bitte wähle einen Spieler für Sitzposition 4')
		.uuid('Ungültige Spieler-ID für Sitzposition 4')
});

const roundTypeValues = RoundTypeDbEnum.enumValues;
const soloTypeValues = SoloTypeDbEnum.enumValues;
const teamValues = TeamDbEnum.enumValues;

export const CreateRoundSchema = z.object({
	type: z.enum(roundTypeValues as [RoundTypeEnum, ...RoundTypeEnum[]]),
	soloType: z.enum(soloTypeValues as [SoloTypeEnumValue, ...SoloTypeEnumValue[]]).optional(),
	eyesRe: z.coerce.number().int().min(0).max(240),
	teams: z.record(z.string(), z.enum(teamValues as [TeamEnumValue, ...TeamEnumValue[]]))
});

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
	groupId: uuid('group_id')
		.notNull()
		.references(() => GroupTable.id, { onDelete: 'cascade' }),
	maxRoundCount: integer('max_round_count').notNull(), // 8, 12, 16, 20, 24
	withMandatorySolos: boolean('with_mandatory_solos').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	endedAt: timestamp('ended_at')
});
export type GameType = InferSelectModel<typeof GameTable>;
export type GameInsertType = InferInsertModel<typeof GameTable>;

export const GameRoundTable = pgTable('game_round', {
	id: uuid('id').primaryKey().defaultRandom(),
	gameId: uuid('game_id')
		.notNull()
		.references(() => GameTable.id, { onDelete: 'cascade' }),
	roundNumber: integer('round_number').notNull(),
	type: RoundTypeDbEnum('type').notNull(),
	soloType: SoloTypeDbEnum('solo_type'), // optional
	eyesRe: integer('eyes_re').notNull() // 0-240
});
export type GameRoundType = InferSelectModel<typeof GameRoundTable>;
export type GameRoundInsertType = InferInsertModel<typeof GameRoundTable>;

export const GameRoundParticipantTable = pgTable('game_round_participant', {
	id: uuid('id').primaryKey().defaultRandom(),
	roundId: uuid('round_id')
		.notNull()
		.references(() => GameRoundTable.id, { onDelete: 'cascade' }),
	playerId: uuid('player_id')
		.notNull()
		.references(() => PlayerTable.id, { onDelete: 'cascade' }),
	team: TeamDbEnum('team').notNull() // RE oder KONTRA
});
export type GameRoundParticipantType = InferSelectModel<typeof GameRoundParticipantTable>;
export type GameRoundParticipantInsertType = InferInsertModel<typeof GameRoundParticipantTable>;

export const GameParticipantTable = pgTable('game_participant', {
	id: uuid('id').primaryKey().defaultRandom(),
	gameId: uuid('game_id')
		.notNull()
		.references(() => GameTable.id, { onDelete: 'cascade' }),
	playerId: uuid('player_id')
		.notNull()
		.references(() => PlayerTable.id, { onDelete: 'cascade' }),
	seatPosition: integer('seat_position').notNull() // Position in der Sitzreihenfolge (0-3)
});
export type GameParticipantType = InferSelectModel<typeof GameParticipantTable>;
export type GameParticipantInsertType = InferInsertModel<typeof GameParticipantTable>;

export const GameRoundCallTable = pgTable('game_round_call', {
	id: uuid('id').primaryKey().defaultRandom(),
	roundId: uuid('round_id')
		.notNull()
		.references(() => GameRoundTable.id, { onDelete: 'cascade' }),
	playerId: uuid('player_id')
		.notNull()
		.references(() => PlayerTable.id, { onDelete: 'cascade' }),
	callType: CallTypeDbEnum('call_type').notNull()
});
export type GameRoundCallType = InferSelectModel<typeof GameRoundCallTable>;
export type GameRoundCallInsertType = InferInsertModel<typeof GameRoundCallTable>;

export const GameRoundBonusTable = pgTable('game_round_bonus', {
	id: uuid('id').primaryKey().defaultRandom(),
	roundId: uuid('round_id')
		.notNull()
		.references(() => GameRoundTable.id, { onDelete: 'cascade' }),
	playerId: uuid('player_id')
		.notNull()
		.references(() => PlayerTable.id, { onDelete: 'cascade' }),
	bonusType: BonusTypeDbEnum('bonus_type').notNull(),
	count: integer('count').notNull().default(0) // Anzahl der Bonus-Punkte
});
export type GameRoundBonusType = InferSelectModel<typeof GameRoundBonusTable>;
export type GameRoundBonusInsertType = InferInsertModel<typeof GameRoundBonusTable>;

export const GameRoundResultTable = pgTable('game_round_result', {
	id: uuid('id').primaryKey().defaultRandom(),
	roundId: uuid('round_id')
		.notNull()
		.references(() => GameRoundTable.id, { onDelete: 'cascade' }),
	playerId: uuid('player_id')
		.notNull()
		.references(() => PlayerTable.id, { onDelete: 'cascade' }),
	points: integer('points').notNull(),
	result: RoundResultDbEnum('result').notNull() // WON, LOST, DRAW
});
export type GameRoundResultType = InferSelectModel<typeof GameRoundResultTable>;
export type GameRoundResultInsertType = InferInsertModel<typeof GameRoundResultTable>;
