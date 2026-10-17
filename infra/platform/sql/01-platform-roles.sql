-- Platform DB roles hook (M12) — root ownership.
-- Invoked from infra/deploy/init-db.sh with env-substituted password.
-- BE migrations grant table privileges; this file only creates roles + posture.
--
-- Assert in tests: rolsuper=false, rolbypassrls=false; no SELECT on
-- tickets / ticket_credentials / broad users PII.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ticket_platform_runtime') THEN
    CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

-- LOGIN role created by init-db.sh (password from env). Idempotent grant:
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ticket_platform_app') THEN
    EXECUTE 'GRANT ticket_platform_runtime TO ticket_platform_app';
  END IF;
END
$$;

COMMENT ON ROLE ticket_platform_runtime IS
  'Platform metadata/limits/operators only; NOBYPASSRLS; no tickets/PII grants';
