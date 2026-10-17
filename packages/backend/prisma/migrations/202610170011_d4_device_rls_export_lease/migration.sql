-- Device tokens: FORCE RLS scoped to verified app.actor_id (not USING true).
-- Worker push uses narrow SECURITY DEFINER helpers (token/env only, no broad PII).
-- Export jobs: lease reclaim for stuck PROCESSING after worker crash.

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_tokens_actor ON device_tokens;
CREATE POLICY device_tokens_actor ON device_tokens TO ticket_runtime
  USING (
    user_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  );

-- FORCE RLS applies to table owner; narrow definer helpers need an owner policy
-- (not USING true for ticket_runtime). Worker/API still use actor or SECURITY DEFINER.
CREATE POLICY device_tokens_owner ON device_tokens TO migration_owner
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON device_tokens FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON device_tokens TO ticket_runtime;

-- Revoke every active row for a physical APNs token (reassignment / APNs invalidate).
CREATE OR REPLACE FUNCTION revoke_active_device_tokens_by_value(p_token text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  n integer;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 16 OR char_length(p_token) > 512 THEN
    RAISE EXCEPTION 'invalid device token';
  END IF;
  UPDATE public.device_tokens
  SET revoked_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE token = p_token
    AND revoked_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION revoke_active_device_tokens_by_value(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revoke_active_device_tokens_by_value(text) TO ticket_runtime;

-- Worker-only: list active tokens for a ticket owner (id/token/env — no email/PII).
CREATE OR REPLACE FUNCTION list_active_device_tokens_for_user(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  token text,
  environment text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid user id';
  END IF;
  RETURN QUERY
  SELECT d.id, d.token, d.environment
  FROM public.device_tokens d
  WHERE d.user_id = p_user_id
    AND d.revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION list_active_device_tokens_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_active_device_tokens_for_user(uuid) TO ticket_runtime;

-- Export lease reclaim
ALTER TABLE exports
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

-- FORCE RLS applies to the function owner; claim_exports_batch (SECURITY DEFINER,
-- owned by migration_owner, NOBYPASSRLS) needs an owner policy so PENDING rows
-- are visible. ticket_runtime keeps tenant isolation only — never USING (true).
DROP POLICY IF EXISTS exports_owner ON exports;
CREATE POLICY exports_owner ON exports TO migration_owner
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION claim_exports_batch(
  p_limit integer,
  p_lease_owner text
)
RETURNS TABLE (
  export_id uuid,
  tenant_id uuid,
  event_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 20 THEN
    RAISE EXCEPTION 'invalid claim limit';
  END IF;
  IF p_lease_owner IS NULL OR length(p_lease_owner) < 1 OR length(p_lease_owner) > 128 THEN
    RAISE EXCEPTION 'invalid lease owner';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT e.id, e.tenant_id
    FROM public.exports e
    WHERE e.status = 'PENDING'
       OR (
         e.status = 'PROCESSING'
         AND e.lease_expires_at IS NOT NULL
         AND e.lease_expires_at < clock_timestamp()
       )
    ORDER BY e.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  updated AS (
    UPDATE public.exports e
    SET status = 'PROCESSING',
        lease_owner = p_lease_owner,
        lease_expires_at = clock_timestamp() + interval '120 seconds',
        updated_at = clock_timestamp()
    FROM candidates c
    WHERE e.tenant_id = c.tenant_id AND e.id = c.id
    RETURNING e.id, e.tenant_id, e.event_id
  )
  SELECT u.id, u.tenant_id, u.event_id FROM updated u;
END;
$$;

REVOKE ALL ON FUNCTION claim_exports_batch(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_exports_batch(integer, text) TO ticket_runtime;
-- Keep ownership on the non-BYPASS migration role (never superuser / runtime login).
ALTER FUNCTION claim_exports_batch(integer, text) OWNER TO migration_owner;
