CREATE TYPE "public"."auth_provider" AS ENUM('LOCAL', 'GOOGLE', 'APPLE');--> statement-breakpoint
CREATE TYPE "public"."bonus_type" AS ENUM('DOKO', 'FUCHS', 'KARLCHEN');--> statement-breakpoint
CREATE TYPE "public"."call_type" AS ENUM('RE', 'KONTRA', 'KEINE90', 'KEINE60', 'KEINE30', 'SCHWARZ');--> statement-breakpoint
CREATE TYPE "public"."round_result" AS ENUM('WON', 'LOST', 'DRAW');--> statement-breakpoint
CREATE TYPE "public"."round_type" AS ENUM('NORMAL', 'HOCHZEIT_NORMAL', 'HOCHZEIT_STILL', 'HOCHZEIT_UNGEKLAERT', 'SOLO_DAMEN', 'SOLO_BUBEN', 'SOLO_KREUZ', 'SOLO_PIK', 'SOLO_HERZ', 'SOLO_KARO', 'SOLO_ASS');--> statement-breakpoint
CREATE TYPE "public"."solo_type" AS ENUM('PFLICHT', 'LUST');--> statement-breakpoint
CREATE TYPE "public"."team" AS ENUM('RE', 'KONTRA');--> statement-breakpoint
CREATE TABLE "game_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"seat_position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_round_bonus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"bonus_type" "bonus_type" NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_round_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"call_type" "call_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_round_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"team" "team" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_round_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"result" "round_result" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_round" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"type" "round_type" NOT NULL,
	"solo_type" "solo_type",
	"eyes_re" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"max_round_count" integer NOT NULL,
	"with_mandatory_solos" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "group_member" (
	"group_id" uuid,
	"player_id" uuid
);
--> statement-breakpoint
CREATE TABLE "group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"auth_provider" "auth_provider" DEFAULT 'LOCAL' NOT NULL,
	"auth_provider_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_participant" ADD CONSTRAINT "game_participant_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participant" ADD CONSTRAINT "game_participant_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round_bonus" ADD CONSTRAINT "game_round_bonus_round_id_game_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round_bonus" ADD CONSTRAINT "game_round_bonus_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round_call" ADD CONSTRAINT "game_round_call_round_id_game_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round_call" ADD CONSTRAINT "game_round_call_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round_participant" ADD CONSTRAINT "game_round_participant_round_id_game_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round_participant" ADD CONSTRAINT "game_round_participant_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round_result" ADD CONSTRAINT "game_round_result_round_id_game_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round_result" ADD CONSTRAINT "game_round_result_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_round" ADD CONSTRAINT "game_round_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;