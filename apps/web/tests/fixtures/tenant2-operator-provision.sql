-- FIXTURE ONLY — not production data.
-- Operator-provisioned second tenant + staff membership for local UAT.
-- Does NOT create events (event must be created via /admin → POST create when BE ships).
-- Use on a task-specific Postgres only; never against shared ticket_dev without isolation.
--
-- Example (task DB on a dedicated port):
--   psql "$DATABASE_URL" -f apps/web/tests/fixtures/tenant2-operator-provision.sql
--
-- After seed: open /admin with Tenant ID = :tenant2_id, create event via UI (not SQL).

BEGIN;

-- Fixed UUIDs for reproducible headless scripts (fixture labels only).
-- tenant2 ≠ sunburst/FUN FEST pilot.
INSERT INTO tenants (id, slug, name)
VALUES (
  'a2222222-2222-4222-8222-222222222222',
  'aurora-ops',
  'Aurora Ops (fixture tenant 2)'
)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name;

-- Link an already-synced OIDC user (issuer/subject from Keycloak) by email if present.
-- Replace :user_id after resolving via: SELECT id FROM users WHERE email = 'organizer@example.com';
-- Membership role/permissions: event.create assumed until BE publishes exact permission names.
-- INSERT INTO memberships (...) — fill when Keycloak user UUID known for the UAT run.

COMMIT;
