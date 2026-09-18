-- Existing servers keep their current open-join behavior.
CREATE TYPE "server_visibility" AS ENUM ('public', 'private');

ALTER TABLE "servers"
ADD COLUMN "visibility" "server_visibility" NOT NULL DEFAULT 'public';

CREATE TABLE "invites" (
    "code" VARCHAR(16) NOT NULL,
    "server_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "max_uses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "invites_max_uses_check" CHECK ("max_uses" IS NULL OR "max_uses" > 0),
    CONSTRAINT "invites_uses_check" CHECK ("uses" >= 0)
);

CREATE INDEX "invites_server_id_idx" ON "invites"("server_id");

ALTER TABLE "invites" ADD CONSTRAINT "invites_server_id_fkey"
FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;
