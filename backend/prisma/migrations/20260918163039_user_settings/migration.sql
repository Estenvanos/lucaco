-- CreateEnum
CREATE TYPE "theme" AS ENUM ('system', 'dark', 'light');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "audio_input_id" VARCHAR(256),
ADD COLUMN     "audio_output_id" VARCHAR(256),
ADD COLUMN     "hidden_notification_tags" "notification_tag"[] DEFAULT ARRAY[]::"notification_tag"[],
ADD COLUMN     "notifications_muted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "theme" "theme" NOT NULL DEFAULT 'system';
