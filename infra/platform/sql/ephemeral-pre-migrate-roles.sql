-- Ephemeral / throwaway Postgres roles required BEFORE Prisma migrations that
-- reference them (CREATE POLICY … TO role, GRANT … TO role).
--
-- Used by D5 drills, R-INT recovery, metrics scrape, and load baseline.
-- Production/compose path uses infra/deploy/init-db.sh (+ 01-platform-roles.sql).
--
-- Do not put LOGIN passwords here — drill scripts create LOGIN roles separately.

CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
