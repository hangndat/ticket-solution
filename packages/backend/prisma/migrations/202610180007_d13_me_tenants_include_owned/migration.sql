-- D13: owner email deeplink `/t/{slug}/tickets/{id}` resolves slug via me/tenants.
-- Ticket owners are often not memberships — include those tenants as Attendee
-- (empty permissions). Membership row wins when both exist.

CREATE OR REPLACE FUNCTION list_my_tenants()
RETURNS TABLE (
  tenant_id uuid,
  slug text,
  name text,
  status text,
  role text,
  permissions text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor uuid;
BEGIN
  actor := NULLIF(current_setting('app.actor_id', true), '')::uuid;
  IF actor IS NULL THEN
    RAISE EXCEPTION 'actor required';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (x.tenant_id)
    x.tenant_id,
    x.slug,
    x.name,
    x.status,
    x.role,
    x.permissions
  FROM (
    SELECT
      t.id AS tenant_id,
      t.slug,
      t.name,
      t.status,
      m.role,
      m.permissions,
      0 AS rank
    FROM memberships m
    JOIN tenants t ON t.id = m.tenant_id
    WHERE m.user_id = actor
      AND m.revoked_at IS NULL
      AND m.activated_at IS NOT NULL
      AND m.activated_at <= clock_timestamp()

    UNION ALL

    SELECT
      t.id AS tenant_id,
      t.slug,
      t.name,
      t.status,
      'Attendee'::text AS role,
      ARRAY[]::text[] AS permissions,
      1 AS rank
    FROM tickets tk
    JOIN tenants t ON t.id = tk.tenant_id
    WHERE tk.owner_user_id = actor
  ) x
  ORDER BY x.tenant_id, x.rank ASC, x.slug ASC;
END;
$$;

REVOKE ALL ON FUNCTION list_my_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_my_tenants() TO ticket_runtime;
