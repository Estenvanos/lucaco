-- Member tags were dropped from the server settings. Their policies go with the tables.
DROP TABLE "member_tags";
DROP TABLE "server_tags";

-- The audit log no longer knows these actions.
DELETE FROM "audit_logs"
WHERE "action" IN ('tag_create', 'tag_update', 'tag_delete', 'member_tag_add', 'member_tag_remove');

-- Only used by the member_tags insert policy.
DROP FUNCTION app_member_server(UUID);
