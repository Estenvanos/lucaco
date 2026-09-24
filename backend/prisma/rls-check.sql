-- Proves the enforced RLS policies from the server_settings migration against a real database.
-- Everything runs in one transaction and is rolled back. Fails loudly on the first broken rule.
--   docker compose exec -T postgres psql -U lucaco -d lucaco -v ON_ERROR_STOP=1 -f - < backend/prisma/rls-check.sql
\set owner    '''aaaaaaaa-0000-0000-0000-000000000001'''
\set member   '''aaaaaaaa-0000-0000-0000-000000000002'''
\set outsider '''aaaaaaaa-0000-0000-0000-000000000003'''
\set server   '''aaaaaaaa-0000-0000-0000-0000000000f1'''

BEGIN;

-- Fixtures, as the table owner.
INSERT INTO users (id, username, email, password_hash, updated_at) VALUES
  (:owner, 'rls_owner', 'rls_owner@x.test', 'x', now()),
  (:member, 'rls_member', 'rls_member@x.test', 'x', now()),
  (:outsider, 'rls_outsider', 'rls_outsider@x.test', 'x', now());
INSERT INTO servers (id, owner_id, name) VALUES (:server, :owner, 'rls');
INSERT INTO roles (server_id, name, permissions, is_default) VALUES (:server, '@everyone', 1, true);
INSERT INTO server_members (server_id, user_id) VALUES (:server, :owner);
INSERT INTO server_members (server_id, user_id) VALUES (:server, :member);
INSERT INTO server_rules (server_id, position, content) VALUES (:server, 0, 'Sem spam');
INSERT INTO audit_logs (server_id, actor_id, action) VALUES (:server, :owner, 'server_update');
INSERT INTO server_bans (server_id, user_id, banned_by) VALUES (:server, :outsider, :owner);

SET LOCAL ROLE lucaco_app;

-- Outsider: sees nothing, writes nothing.
SELECT set_config('app.user_id', :outsider, true);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM server_rules) = 0, 'outsider reads rules';
  ASSERT (SELECT count(*) FROM audit_logs) = 0, 'outsider reads audit log';
  ASSERT (SELECT count(*) FROM server_bans) = 0, 'outsider reads bans';
END $$;
DO $$ BEGIN
  INSERT INTO server_rules (server_id, position, content) VALUES ('aaaaaaaa-0000-0000-0000-0000000000f1', 1, 'x');
  RAISE EXCEPTION 'outsider wrote a rule';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- Plain member (@everyone has only VIEW_CHANNELS): reads rules, not the log or bans; cannot edit.
SELECT set_config('app.user_id', :member, true);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM server_rules) = 1, 'member cannot read rules';
  ASSERT (SELECT count(*) FROM audit_logs) = 0, 'member without VIEW_AUDIT_LOG reads audit log';
  ASSERT (SELECT count(*) FROM server_bans) = 0, 'member without BAN_MEMBERS reads bans';
END $$;
DO $$ BEGIN
  INSERT INTO server_rules (server_id, position, content) VALUES ('aaaaaaaa-0000-0000-0000-0000000000f1', 1, 'x');
  RAISE EXCEPTION 'member without MANAGE_SERVER wrote a rule';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO audit_logs (server_id, actor_id, action)
  VALUES ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000001', 'member_ban');
  RAISE EXCEPTION 'member logged an action in someone else''s name';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  DELETE FROM server_rules;
  ASSERT (SELECT count(*) FROM server_rules) = 1, 'member deleted rules';
END $$;

-- Owner: everything, and the audit log stays append-only.
SELECT set_config('app.user_id', :owner, true);
INSERT INTO server_rules (server_id, position, content) VALUES (:server, 1, 'Respeito');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM server_rules) = 2, 'owner cannot write rules';
  ASSERT (SELECT count(*) FROM audit_logs) = 1, 'owner cannot read audit log';
  ASSERT (SELECT count(*) FROM server_bans) = 1, 'owner cannot read bans';
  DELETE FROM audit_logs;
  ASSERT (SELECT count(*) FROM audit_logs) = 1, 'audit log entry was deleted';
END $$;

\echo 'RLS check passed'
ROLLBACK;
