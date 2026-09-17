-- CreateEnum
CREATE TYPE "friendship_status" AS ENUM ('pending', 'accepted', 'blocked');

-- CreateTable
CREATE TABLE "friendships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_low_id" UUID NOT NULL,
    "user_high_id" UUID NOT NULL,
    "status" "friendship_status" NOT NULL DEFAULT 'pending',
    "requested_by" UUID NOT NULL,
    "blocked_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "friendships_user_low_id_status_idx" ON "friendships"("user_low_id", "status");

-- CreateIndex
CREATE INDEX "friendships_user_high_id_status_idx" ON "friendships"("user_high_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_user_low_id_user_high_id_key" ON "friendships"("user_low_id", "user_high_id");

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_low_id_fkey" FOREIGN KEY ("user_low_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_high_id_fkey" FOREIGN KEY ("user_high_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_blocked_by_fkey" FOREIGN KEY ("blocked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Canonical order is what makes the pair unique: (a,b) and (b,a) cannot both exist.
-- A CHECK constraint cannot be expressed in the Prisma schema, so it lives here.
ALTER TABLE "friendships" ADD CONSTRAINT "canonical_order" CHECK ("user_low_id" < "user_high_id");
ALTER TABLE "friendships" ADD CONSTRAINT "blocked_has_blocker"
  CHECK (("status" <> 'blocked') OR ("blocked_by" IS NOT NULL));

-- Row Level Security: second layer only, same as servers/roles. The table owner used by
-- DATABASE_URL bypasses it; the API remains the authority.
ALTER TABLE "friendships" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships_own_read" ON "friendships" FOR SELECT USING (
  "user_low_id" = app_user_id() OR "user_high_id" = app_user_id()
);
