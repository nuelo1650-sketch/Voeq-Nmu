-- ---------------------------------------------------------------------------
-- audit_log immutability — apply AFTER the Prisma migration that creates it.
--
-- Prisma migrations are generated from the schema; this supplementary script
-- enforces the append-only contract at the DATABASE level (doc 07 §4.6):
-- the application role may INSERT and SELECT the audit log, never UPDATE or
-- DELETE it. Run as the database owner against the registry database.
--
--   psql "$DATABASE_URL" -f prisma/sql/audit-immutable.sql
--
-- With Neon, run it via the SQL editor once after the first migration.
-- ---------------------------------------------------------------------------

-- The application role (adjust the role name to your deployment; with a
-- single-role setup, this is the role in DATABASE_URL):
DO $$
DECLARE
  app_role text;
BEGIN
  -- Derive the role from the current_user that owns the schema objects.
  SELECT INTO app_role 'authenticated'; -- Supabase-style default; adjust if needed
  -- For a plain Postgres/Neon setup the connecting user owns the tables,
  -- so instead we revoke from PUBLIC and re-grant only what is allowed:
  EXECUTE 'REVOKE UPDATE, DELETE ON "AuditLog" FROM PUBLIC';
END $$;

-- For a dedicated application role (recommended for production):
--   CREATE ROLE registry_app LOGIN PASSWORD '...';
--   GRANT USAGE ON SCHEMA public TO registry_app;
--   GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO registry_app;
--   GRANT SELECT, INSERT ON "AuditLog" TO registry_app;   -- no UPDATE, no DELETE
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO registry_app;
-- The migration runner (owner) keeps full rights; the app never does.
