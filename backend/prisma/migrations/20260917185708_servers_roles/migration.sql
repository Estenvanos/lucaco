-- CreateTable
CREATE TABLE "servers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "server_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nickname" VARCHAR(64),
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "server_id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "color" INTEGER,
    "permissions" BIGINT NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_roles" (
    "member_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "member_roles_pkey" PRIMARY KEY ("member_id","role_id")
);

-- CreateIndex
CREATE INDEX "servers_owner_id_idx" ON "servers"("owner_id");

-- CreateIndex
CREATE INDEX "server_members_server_id_idx" ON "server_members"("server_id");

-- CreateIndex
CREATE INDEX "server_members_user_id_idx" ON "server_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "server_members_server_id_user_id_key" ON "server_members"("server_id", "user_id");

-- CreateIndex
CREATE INDEX "roles_server_id_idx" ON "roles"("server_id");

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_members" ADD CONSTRAINT "server_members_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_members" ADD CONSTRAINT "server_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "server_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one @everyone role per server (a partial unique index cannot be expressed in the Prisma schema).
CREATE UNIQUE INDEX "one_default_role" ON "roles" ("server_id") WHERE "is_default";

-- Row Level Security: second layer only. The API is the authority (see arquitetura-lucaco.md 9.4);
-- these policies limit the damage of a leaked credential that uses a restricted database role.
-- The current DATABASE_URL user owns these tables and therefore BYPASSES every policy below.
-- ponytail: no session context yet — set_config('app.user_id', ...) per request needs a non-owner
-- role plus a Prisma extension wrapping each query in a transaction. Add both when it is worth the cost.
ALTER TABLE "servers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "server_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_roles" ENABLE ROW LEVEL SECURITY;

-- Reads the caller set by the application; NULL (unset) matches nothing.
CREATE FUNCTION app_user_id() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

-- A member sees the servers they belong to; only the owner changes the server row.
CREATE POLICY "servers_member_read" ON "servers" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "server_members" m
    WHERE m."server_id" = "servers"."id" AND m."user_id" = app_user_id()
  )
);
CREATE POLICY "servers_owner_write" ON "servers" FOR ALL USING ("owner_id" = app_user_id());

-- Membership, roles and role assignments are visible to members of the same server.
CREATE POLICY "server_members_read" ON "server_members" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "server_members" mine
    WHERE mine."server_id" = "server_members"."server_id" AND mine."user_id" = app_user_id()
  )
);
CREATE POLICY "roles_read" ON "roles" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "server_members" m
    WHERE m."server_id" = "roles"."server_id" AND m."user_id" = app_user_id()
  )
);
CREATE POLICY "member_roles_read" ON "member_roles" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "server_members" m
    JOIN "server_members" mine ON mine."server_id" = m."server_id"
    WHERE m."id" = "member_roles"."member_id" AND mine."user_id" = app_user_id()
  )
);
