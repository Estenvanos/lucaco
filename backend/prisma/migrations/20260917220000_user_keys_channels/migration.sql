-- CreateEnum
CREATE TYPE "channel_type" AS ENUM ('text', 'voice');

-- CreateTable
CREATE TABLE "user_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "public_key" TEXT NOT NULL,
    "algorithm" VARCHAR(32) NOT NULL DEFAULT 'ECDH-P256',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "server_id" UUID NOT NULL,
    "type" "channel_type" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "topic" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_keys_user_id_idx" ON "user_keys"("user_id");

-- CreateIndex
CREATE INDEX "channels_server_id_idx" ON "channels"("server_id");

-- AddForeignKey
ALTER TABLE "user_keys" ADD CONSTRAINT "user_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial indexes Prisma cannot express: at most one voice channel per server,
-- and one active public key per user.
CREATE UNIQUE INDEX "one_voice_per_server" ON "channels"("server_id") WHERE "type" = 'voice';
CREATE UNIQUE INDEX "one_active_key_per_user" ON "user_keys"("user_id") WHERE "is_active";
