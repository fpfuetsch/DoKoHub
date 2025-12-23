import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { player, group, groupMember } from '$lib/server/db/schema';

export type Player = InferSelectModel<typeof player>;
export type PlayerInsert = InferInsertModel<typeof player>;

export type Group = InferSelectModel<typeof group>;
export type GroupInsert = InferInsertModel<typeof group>;

export type GroupMember = InferSelectModel<typeof groupMember>;
export type GroupMemberInsert = InferInsertModel<typeof groupMember>;
