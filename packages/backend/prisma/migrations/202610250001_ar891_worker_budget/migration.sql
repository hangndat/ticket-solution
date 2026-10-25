-- AR891 F03: aggregate worker queue telemetry and exact lease reclaim counters.
-- Only the SECURITY DEFINER functions below can read or write the counters.
CREATE TABLE public.worker_job_reclaim_counters (
  job_class text PRIMARY KEY CHECK (job_class IN ('relay_outbox', 'relay_exports', 'process_account_anonymizations')),
  reclaim_count bigint NOT NULL DEFAULT 0 CHECK (reclaim_count >= 0)
);
REVOKE ALL ON public.worker_job_reclaim_counters FROM PUBLIC, ticket_runtime;
ALTER TABLE public.worker_job_reclaim_counters OWNER TO migration_owner;
ALTER TABLE public.worker_job_reclaim_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_job_reclaim_counters FORCE ROW LEVEL SECURITY;
-- Definer functions run as migration_owner; runtime roles have no table grant.
CREATE POLICY worker_reclaim_definer ON public.worker_job_reclaim_counters
  FOR ALL TO migration_owner USING (true) WITH CHECK (true);

-- The pending discovery definer runs as migration_owner under FORCE RLS.
-- Restrict its visibility to due envelopes; tenant writes still use withTenant.
CREATE POLICY pending_expiry_definer_due ON public.redemption_requests
  FOR SELECT TO migration_owner
  USING (status = 'PENDING_REVIEW' AND expires_at IS NOT NULL
         AND expires_at <= clock_timestamp());

-- Preserve the claim signature and lease fence used by old workers.
CREATE OR REPLACE FUNCTION public.claim_outbox_batch(
  p_limit integer, p_lease_owner text, p_lease_seconds integer DEFAULT 30
)
RETURNS TABLE (
  outbox_id uuid, tenant_id uuid, event_id uuid, type text,
  aggregate_id uuid, payload_version integer, lease_token text, attempts integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
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
    SELECT o.id, o.status IN ('LEASED', 'PROCESSING') AS reclaimed
    FROM public.outbox o
    WHERE (
      o.status = 'PENDING'
      OR (o.status IN ('LEASED', 'PROCESSING')
          AND o.lease_expires_at IS NOT NULL
          AND o.lease_expires_at < clock_timestamp())
    )
      AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= clock_timestamp())
    ORDER BY o.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), updated AS (
    UPDATE public.outbox o
    SET status = 'LEASED', lease_owner = p_lease_owner,
        lease_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
        attempts = o.attempts + 1, updated_at = clock_timestamp()
    FROM candidates c WHERE o.id = c.id
    RETURNING o.id, o.tenant_id, o.event_id, o.type, o.aggregate_id,
              o.payload_version, o.lease_token, o.attempts
  ), counted AS (
    INSERT INTO public.worker_job_reclaim_counters AS m (job_class, reclaim_count)
    SELECT 'relay_outbox', count(*)::bigint
    FROM candidates c JOIN updated u ON u.id = c.id
    WHERE c.reclaimed
    HAVING count(*) > 0
    ON CONFLICT (job_class) DO UPDATE
      SET reclaim_count = m.reclaim_count + EXCLUDED.reclaim_count
    RETURNING 1
  )
  SELECT u.id, u.tenant_id, u.event_id, u.type, u.aggregate_id,
         u.payload_version, u.lease_token, u.attempts
  FROM updated u LEFT JOIN counted ON true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_outbox_batch(integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_outbox_batch(integer, text, integer) TO ticket_runtime;
ALTER FUNCTION public.claim_outbox_batch(integer, text, integer) OWNER TO migration_owner;

CREATE OR REPLACE FUNCTION public.claim_exports_batch(p_limit integer, p_lease_owner text)
RETURNS TABLE (export_id uuid, tenant_id uuid, event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
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
    SELECT e.id, e.tenant_id, e.status = 'PROCESSING' AS reclaimed
    FROM public.exports e
    WHERE e.status = 'PENDING'
       OR (e.status = 'PROCESSING' AND e.lease_expires_at IS NOT NULL
           AND e.lease_expires_at < clock_timestamp())
    ORDER BY e.created_at FOR UPDATE SKIP LOCKED LIMIT p_limit
  ), updated AS (
    UPDATE public.exports e
    SET status = 'PROCESSING', lease_owner = p_lease_owner,
        lease_expires_at = clock_timestamp() + interval '120 seconds',
        updated_at = clock_timestamp()
    FROM candidates c WHERE e.tenant_id = c.tenant_id AND e.id = c.id
    RETURNING e.id, e.tenant_id, e.event_id
  ), counted AS (
    INSERT INTO public.worker_job_reclaim_counters AS m (job_class, reclaim_count)
    SELECT 'relay_exports', count(*)::bigint
    FROM candidates c JOIN updated u ON u.tenant_id = c.tenant_id AND u.id = c.id
    WHERE c.reclaimed HAVING count(*) > 0
    ON CONFLICT (job_class) DO UPDATE
      SET reclaim_count = m.reclaim_count + EXCLUDED.reclaim_count
    RETURNING 1
  )
  SELECT u.id, u.tenant_id, u.event_id FROM updated u LEFT JOIN counted ON true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_exports_batch(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_exports_batch(integer, text) TO ticket_runtime;
ALTER FUNCTION public.claim_exports_batch(integer, text) OWNER TO migration_owner;

CREATE OR REPLACE FUNCTION public.claim_account_deletion_idp_lease(
  p_request_id uuid, p_owner text, p_ttl_seconds integer DEFAULT 45
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_updated integer;
DECLARE v_reclaimed boolean;
BEGIN
  IF p_request_id IS NULL OR p_owner IS NULL OR length(p_owner) < 1 THEN
    RAISE EXCEPTION 'invalid lease claim';
  END IF;
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 5 OR p_ttl_seconds > 300 THEN
    RAISE EXCEPTION 'invalid lease ttl';
  END IF;
  WITH previous AS (
    SELECT r.id, r.idp_lease_owner IS NOT NULL
      AND r.idp_lease_expires_at < clock_timestamp() AS reclaimed
    FROM public.account_deletion_requests r
    WHERE r.id = p_request_id AND r.state = 'REQUESTED'
    FOR UPDATE
  ), updated AS (
    UPDATE public.account_deletion_requests r
    SET idp_lease_owner = p_owner,
        idp_lease_expires_at = clock_timestamp() + make_interval(secs => p_ttl_seconds),
        updated_at = clock_timestamp()
    FROM previous p
    WHERE r.id = p.id
      AND (r.idp_lease_owner IS NULL OR r.idp_lease_owner = p_owner
           OR r.idp_lease_expires_at IS NULL
           OR r.idp_lease_expires_at < clock_timestamp())
    RETURNING r.id
  )
  SELECT count(*)::integer, COALESCE(bool_or(p.reclaimed), false)
    INTO v_updated, v_reclaimed
  FROM updated u JOIN previous p ON p.id = u.id;
  IF v_updated = 1 AND v_reclaimed THEN
    INSERT INTO public.worker_job_reclaim_counters AS m (job_class, reclaim_count)
    VALUES ('process_account_anonymizations', 1)
    ON CONFLICT (job_class) DO UPDATE
      SET reclaim_count = m.reclaim_count + EXCLUDED.reclaim_count;
  END IF;
  RETURN v_updated = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_account_deletion_idp_lease(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_account_deletion_idp_lease(uuid, text, integer) TO ticket_runtime;
ALTER FUNCTION public.claim_account_deletion_idp_lease(uuid, text, integer) OWNER TO migration_owner;

-- No row identifiers or tenant labels leave this function.
CREATE FUNCTION public.worker_due_job_snapshot()
RETURNS TABLE (job_class text, oldest_due_age_seconds double precision,
               due_count integer, reclaim_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT 'reconcile_pending_redemptions'::text,
    COALESCE(EXTRACT(EPOCH FROM clock_timestamp() - MIN(r.expires_at)), 0)::float8,
    count(*)::integer, 0::bigint
  FROM public.redemption_requests r
  WHERE r.status = 'PENDING_REVIEW' AND r.expires_at <= clock_timestamp()
  UNION ALL
  SELECT 'relay_outbox'::text,
    COALESCE(EXTRACT(EPOCH FROM clock_timestamp() - MIN(
      CASE WHEN o.status = 'PENDING' THEN COALESCE(o.next_attempt_at, o.created_at)
           ELSE GREATEST(COALESCE(o.next_attempt_at, o.created_at), o.lease_expires_at)
      END)), 0)::float8,
    count(*)::integer,
    COALESCE((SELECT m.reclaim_count FROM public.worker_job_reclaim_counters m
              WHERE m.job_class = 'relay_outbox'), 0)
  FROM public.outbox o
  WHERE (o.status = 'PENDING'
      OR (o.status IN ('LEASED', 'PROCESSING') AND o.lease_expires_at < clock_timestamp()))
    AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= clock_timestamp())
  UNION ALL
  SELECT 'process_account_anonymizations'::text,
    COALESCE(EXTRACT(EPOCH FROM clock_timestamp() - MIN(
      COALESCE(r.idp_next_attempt_at, r.requested_at))), 0)::float8,
    count(*)::integer,
    COALESCE((SELECT m.reclaim_count FROM public.worker_job_reclaim_counters m
              WHERE m.job_class = 'process_account_anonymizations'), 0)
  FROM public.account_deletion_requests r
  WHERE r.state = 'REQUESTED' AND r.policy_version IS NOT NULL
    AND r.requested_at <= clock_timestamp()
    AND (r.idp_status IS NULL OR r.idp_status IN ('PENDING', 'DISABLED_PENDING_DELETE', 'FAILED'))
    AND (r.idp_next_attempt_at IS NULL OR r.idp_next_attempt_at <= clock_timestamp())
  UNION ALL
  SELECT 'relay_exports'::text,
    COALESCE(EXTRACT(EPOCH FROM clock_timestamp() - MIN(
      CASE WHEN e.status = 'PENDING' THEN e.created_at
           ELSE e.lease_expires_at END)), 0)::float8,
    count(*)::integer,
    COALESCE((SELECT m.reclaim_count FROM public.worker_job_reclaim_counters m
              WHERE m.job_class = 'relay_exports'), 0)
  FROM public.exports e
  WHERE e.status = 'PENDING'
     OR (e.status = 'PROCESSING' AND e.lease_expires_at < clock_timestamp())
  UNION ALL
  SELECT 'cleanup_import_files'::text,
    COALESCE(EXTRACT(EPOCH FROM clock_timestamp() - MIN(f.expires_at)), 0)::float8,
    count(*)::integer, 0::bigint
  FROM public.import_files f
  WHERE f.consumed_at IS NULL AND f.expires_at < clock_timestamp();
$$;
REVOKE ALL ON FUNCTION public.worker_due_job_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_due_job_snapshot() TO ticket_runtime;
ALTER FUNCTION public.worker_due_job_snapshot() OWNER TO migration_owner;
