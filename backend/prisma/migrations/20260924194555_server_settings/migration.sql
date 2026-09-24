-- AlterTable
ALTER TABLE "servers" ADD COLUMN     "tag" VARCHAR(4);

-- CreateTable
CREATE TABLE "server_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "server_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "content" VARCHAR(300) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "server_id" UUID NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "color" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_tags" (
    "member_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "member_tags_pkey" PRIMARY KEY ("member_id","tag_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "server_id" UUID NOT NULL,
    "actor_id" UUID,
    "target_user_id" UUID,
    "action" VARCHAR(32) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "server_rules_server_id_idx" ON "server_rules"("server_id");

-- CreateIndex
CREATE UNIQUE INDEX "server_tags_server_id_name_key" ON "server_tags"("server_id", "name");

-- CreateIndex
CREATE INDEX "audit_logs_server_id_created_at_idx" ON "audit_logs"("server_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "server_rules" ADD CONSTRAINT "server_rules_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_tags" ADD CONSTRAINT "server_tags_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_tags" ADD CONSTRAINT "member_tags_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "server_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_tags" ADD CONSTRAINT "member_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "server_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security, enforced. The API connects as the table owner (which bypasses RLS), so the
-- modules that own these tables run their queries through withUser() (lib/prisma.ts): a
-- transaction that does SET LOCAL ROLE lucaco_app and set_config('app.user_id', ...).
-- lucaco_app does not own the tables, so every policy below applies to it.
DO $$ BEGIN
  CREATE ROLE lucaco_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Lets the connecting user switch to lucaco_app even when it is not a superuser.
GRANT lucaco_app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO lucaco_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "server_rules", "server_tags", "member_tags", "audit_logs", "server_bans" TO lucaco_app;

-- SECURITY DEFINER: they read server_members/roles as the owner, so a policy that calls them never
-- recurses into another policy (and lucaco_app needs no grant on those tables).
CREATE FUNCTION app_is_member(sid UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM server_members WHERE server_id = sid AND user_id = app_user_id())
$$;

CREATE FUNCTION app_member_server(mid UUID) RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT server_id FROM server_members WHERE id = mid
$$;

-- Mirrors servers.services permissionsFor + has(): the owner holds everything; otherwise the OR of
-- @everyone and the member's roles must contain the bit or ADMINISTRATOR (1 << 9 = 512).
CREATE FUNCTION app_has_permission(sid UUID, perm BIGINT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM servers WHERE id = sid AND owner_id = app_user_id())
    OR EXISTS (
      SELECT 1
      FROM server_members m
      JOIN roles r ON r.server_id = m.server_id
      WHERE m.server_id = sid
        AND m.user_id = app_user_id()
        AND (r.is_default OR EXISTS (
          SELECT 1 FROM member_roles mr WHERE mr.member_id = m.id AND mr.role_id = r.id))
        AND (r.permissions & (perm | 512)) <> 0
    )
$$;

-- The old policy queried server_members from inside a server_members policy, which Postgres
-- rejects as infinite recursion once the policy is actually enforced.
DROP POLICY "server_members_read" ON "server_members";
CREATE POLICY "server_members_read" ON "server_members" FOR SELECT USING (app_is_member("server_id"));

-- Rules: every member reads them; MANAGE_SERVER (1 << 7 = 128) edits them.
ALTER TABLE "server_rules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server_rules_read" ON "server_rules" FOR SELECT USING (app_is_member("server_id"));
CREATE POLICY "server_rules_insert" ON "server_rules" FOR INSERT WITH CHECK (app_has_permission("server_id", 128));
CREATE POLICY "server_rules_update" ON "server_rules" FOR UPDATE USING (app_has_permission("server_id", 128));
CREATE POLICY "server_rules_delete" ON "server_rules" FOR DELETE USING (app_has_permission("server_id", 128));

-- Tags: every member reads them; MANAGE_ROLES (1 << 6 = 64) manages tags and who holds them.
ALTER TABLE "server_tags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server_tags_read" ON "server_tags" FOR SELECT USING (app_is_member("server_id"));
CREATE POLICY "server_tags_insert" ON "server_tags" FOR INSERT WITH CHECK (app_has_permission("server_id", 64));
CREATE POLICY "server_tags_update" ON "server_tags" FOR UPDATE USING (app_has_permission("server_id", 64));
CREATE POLICY "server_tags_delete" ON "server_tags" FOR DELETE USING (app_has_permission("server_id", 64));

-- server_tags is read as lucaco_app here, so its own read policy applies inside the subquery too.
ALTER TABLE "member_tags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_tags_read" ON "member_tags" FOR SELECT USING (
  EXISTS (SELECT 1 FROM server_tags t WHERE t.id = "member_tags"."tag_id" AND app_is_member(t.server_id))
);
CREATE POLICY "member_tags_insert" ON "member_tags" FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM server_tags t
    WHERE t.id = "member_tags"."tag_id"
      AND app_has_permission(t.server_id, 64)
      -- the member must belong to the tag's server
      AND app_member_server("member_tags"."member_id") = t.server_id
  )
);
CREATE POLICY "member_tags_delete" ON "member_tags" FOR DELETE USING (
  EXISTS (SELECT 1 FROM server_tags t WHERE t.id = "member_tags"."tag_id" AND app_has_permission(t.server_id, 64))
);

-- Audit log: append-only. VIEW_AUDIT_LOG (1 << 14 = 16384) reads it; a row can only be written in
-- the caller's own name. No UPDATE or DELETE policy, so nobody going through RLS can rewrite it.
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_read" ON "audit_logs" FOR SELECT USING (app_has_permission("server_id", 16384));
CREATE POLICY "audit_logs_insert" ON "audit_logs" FOR INSERT WITH CHECK (
  "actor_id" = app_user_id() AND app_is_member("server_id")
);

-- Bans: BAN_MEMBERS (1 << 12 = 4096) lists and lifts them.
ALTER TABLE "server_bans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server_bans_read" ON "server_bans" FOR SELECT USING (app_has_permission("server_id", 4096));
CREATE POLICY "server_bans_delete" ON "server_bans" FOR DELETE USING (app_has_permission("server_id", 4096));
