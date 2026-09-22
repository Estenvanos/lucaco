-- CreateEnum
CREATE TYPE "media_kind" AS ENUM ('voice', 'image', 'file', 'video');

-- AlterTable: every file so far is a voice message
ALTER TABLE "media_files" ADD COLUMN "kind" "media_kind" NOT NULL DEFAULT 'voice';

-- ATTACH_FILES (1 << 13) for @everyone of the servers that already exist
UPDATE "roles" SET "permissions" = "permissions" | 8192 WHERE "is_default";
