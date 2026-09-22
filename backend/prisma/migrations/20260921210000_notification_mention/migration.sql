-- AlterEnum
ALTER TYPE "notification_tag" ADD VALUE 'mention';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "server_id" UUID,
ADD COLUMN "channel_id" UUID;
