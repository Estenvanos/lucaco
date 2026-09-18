-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('online', 'offline', 'dnd');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status" "user_status" NOT NULL DEFAULT 'online';

-- Every server opens on a "geral" text channel and has its single "voz" voice channel.
-- New servers get both in servers.create; this backfills the ones created before.
INSERT INTO "channels" ("server_id", "type", "name", "position")
SELECT s."id", 'text', 'geral', 0 FROM "servers" s
WHERE NOT EXISTS (SELECT 1 FROM "channels" c WHERE c."server_id" = s."id" AND c."type" = 'text');

INSERT INTO "channels" ("server_id", "type", "name", "position")
SELECT s."id", 'voice', 'voz', 0 FROM "servers" s
WHERE NOT EXISTS (SELECT 1 FROM "channels" c WHERE c."server_id" = s."id" AND c."type" = 'voice');
