-- O02: staff discovery — list_my_events() + my_staff_eligible()
-- Parallel to list_my_tenants(); actor from GUC set by verified identity.
--
-- FORCE RLS on event_assignments had no migration_owner policy, so SECURITY DEFINER
-- accept_membership_invite / list_my_events could not read/write assignments.
CREATE POLICY event_assignments_owner ON event_assignments TO migration_owner
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION list_my_events()
RETURNS TABLE (
  tenant_id uuid,
  event_id uuid,
  name text,
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
  SELECT e.tenant_id, e.id, e.name, ea.permissions
  FROM event_assignments ea
  JOIN memberships m
    ON m.tenant_id = ea.tenant_id
   AND m.id = ea.membership_id
  JOIN events e
    ON e.tenant_id = ea.tenant_id
   AND e.id = ea.event_id
  WHERE m.user_id = actor
    AND m.revoked_at IS NULL
    AND m.activated_at IS NOT NULL
    AND m.activated_at <= clock_timestamp()
    AND ea.revoked_at IS NULL
    AND ea.activated_at IS NOT NULL
    AND ea.activated_at <= clock_timestamp()
  ORDER BY e.name, e.id;
END;
$$;
REVOKE ALL ON FUNCTION list_my_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_my_events() TO ticket_runtime;

CREATE OR REPLACE FUNCTION my_staff_eligible()
RETURNS boolean
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
  RETURN EXISTS (
    SELECT 1
    FROM memberships m
    WHERE m.user_id = actor
      AND m.revoked_at IS NULL
      AND m.activated_at IS NOT NULL
      AND m.activated_at <= clock_timestamp()
  ) OR EXISTS (
    SELECT 1
    FROM event_assignments ea
    JOIN memberships m
      ON m.tenant_id = ea.tenant_id
     AND m.id = ea.membership_id
    WHERE m.user_id = actor
      AND m.revoked_at IS NULL
      AND m.activated_at IS NOT NULL
      AND m.activated_at <= clock_timestamp()
      AND ea.revoked_at IS NULL
      AND ea.activated_at IS NOT NULL
      AND ea.activated_at <= clock_timestamp()
  );
END;
$$;
REVOKE ALL ON FUNCTION my_staff_eligible() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION my_staff_eligible() TO ticket_runtime;
