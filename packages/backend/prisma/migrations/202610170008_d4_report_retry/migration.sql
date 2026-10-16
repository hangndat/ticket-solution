-- D4: outbox claim waits until next_attempt_at.
-- notifications is FORCE RLS, so the cross-tenant claim function cannot read it.
-- The failure path writes the same timestamp on the outbox row (RLS enabled, not forced).

ALTER TABLE outbox
  ADD COLUMN next_attempt_at timestamptz;

-- Signature is unchanged so existing EXECUTE grants remain.

CREATE OR REPLACE FUNCTION claim_outbox_batch(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer DEFAULT 30
)
RETURNS TABLE (
  outbox_id uuid,
  tenant_id uuid,
  event_id uuid,
  type text,
  aggregate_id uuid,
  payload_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'invalid claim limit';
  END IF;
  IF p_lease_owner IS NULL OR length(p_lease_owner) < 1 OR length(p_lease_owner) > 128 THEN
    RAISE EXCEPTION 'invalid lease owner';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'invalid lease seconds';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM public.outbox o
    WHERE (
        o.status = 'PENDING'
        OR (
          o.status IN ('LEASED', 'PROCESSING')
          AND o.lease_expires_at IS NOT NULL
          AND o.lease_expires_at < clock_timestamp()
        )
      )
      AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= clock_timestamp())
    ORDER BY o.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  updated AS (
    UPDATE public.outbox o
    SET status = 'LEASED',
        lease_owner = p_lease_owner,
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
        attempts = o.attempts + 1,
        updated_at = clock_timestamp()
    FROM candidates c
    WHERE o.id = c.id
    RETURNING o.id, o.tenant_id, o.event_id, o.type, o.aggregate_id, o.payload_version
  )
  SELECT u.id, u.tenant_id, u.event_id, u.type, u.aggregate_id, u.payload_version
  FROM updated u;
END;
$$;

REVOKE ALL ON FUNCTION claim_outbox_batch(integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_outbox_batch(integer, text, integer) TO ticket_runtime;
