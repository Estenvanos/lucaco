-- CreateEnum
CREATE TYPE "message_scope" AS ENUM ('dm', 'channel');

-- CreateTable
CREATE TABLE "channel_role_permissions" (
    "channel_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "allow" BIGINT NOT NULL DEFAULT 0,
    "deny" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "channel_role_permissions_pkey" PRIMARY KEY ("channel_id","role_id")
);

-- CreateTable
CREATE TABLE "channel_member_permissions" (
    "channel_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "allow" BIGINT NOT NULL DEFAULT 0,
    "deny" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "channel_member_permissions_pkey" PRIMARY KEY ("channel_id","member_id")
);

-- CreateTable
CREATE TABLE "channel_key_epochs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel_id" UUID NOT NULL,
    "epoch" INTEGER NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_key_epochs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_key_shares" (
    "epoch_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "wrapped_by" UUID NOT NULL,
    "wrapper_public_key" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "iv" TEXT NOT NULL,

    CONSTRAINT "channel_key_shares_pkey" PRIMARY KEY ("epoch_id","recipient_id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uploader_id" UUID NOT NULL,
    "scope" "message_scope" NOT NULL,
    "conversation_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_role_permissions_role_id_idx" ON "channel_role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "channel_member_permissions_member_id_idx" ON "channel_member_permissions"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_key_epochs_channel_id_epoch_key" ON "channel_key_epochs"("channel_id", "epoch");

-- CreateIndex
CREATE INDEX "channel_key_shares_recipient_id_idx" ON "channel_key_shares"("recipient_id");

-- CreateIndex
CREATE INDEX "media_files_conversation_id_idx" ON "media_files"("conversation_id");

-- AddForeignKey
ALTER TABLE "channel_role_permissions" ADD CONSTRAINT "channel_role_permissions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_role_permissions" ADD CONSTRAINT "channel_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_member_permissions" ADD CONSTRAINT "channel_member_permissions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_member_permissions" ADD CONSTRAINT "channel_member_permissions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "server_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_key_epochs" ADD CONSTRAINT "channel_key_epochs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_key_shares" ADD CONSTRAINT "channel_key_shares_epoch_id_fkey" FOREIGN KEY ("epoch_id") REFERENCES "channel_key_epochs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_key_shares" ADD CONSTRAINT "channel_key_shares_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: channel management used to ride on MANAGE_SERVER (1 << 7); keep those roles able to do it
-- with the new MANAGE_CHANNELS (1 << 10). Voice messages (1 << 11) are on for @everyone by default.
UPDATE "roles" SET "permissions" = "permissions" | 1024 WHERE ("permissions" & 128) <> 0;
UPDATE "roles" SET "permissions" = "permissions" | 2048 WHERE "is_default";
