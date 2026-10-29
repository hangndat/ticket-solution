-- O06: durable clocks and row-lock ordering for irreversible retention work.
-- Keep this forward-only: 001-004 may already be applied in local databases.
ALTER TABLE public.events ADD COLUMN export_retention_fenced_at timestamptz;
ALTER TABLE public.worker_job_reclaim_counters
  DROP CONSTRAINT worker_job_reclaim_counters_job_class_check;
ALTER TABLE public.worker_job_reclaim_counters
  ADD CONSTRAINT worker_job_reclaim_counters_job_class_check
  CHECK (job_class IN ('relay_outbox', 'relay_exports',
    'process_account_anonymizations', 'process_export_object_retentions'));

CREATE FUNCTION public.guard_o06_event_clocks() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.ticket_pii_anonymized_at IS NOT NULL THEN
    IF NEW.ticket_pii_anonymized_at IS DISTINCT FROM OLD.ticket_pii_anonymized_at
       OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
       OR NEW.business_status IS DISTINCT FROM OLD.business_status
       OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN
      RAISE EXCEPTION 'EVENT_RETENTION_FENCED' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF OLD.export_retention_fenced_at IS NOT NULL THEN
    IF NEW.export_retention_fenced_at IS DISTINCT FROM OLD.export_retention_fenced_at
       OR NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
      RAISE EXCEPTION 'EVENT_RETENTION_FENCED' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER events_o06_clock_guard BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.guard_o06_event_clocks();
REVOKE ALL ON FUNCTION public.guard_o06_event_clocks() FROM PUBLIC;
ALTER FUNCTION public.guard_o06_event_clocks() OWNER TO migration_owner;

-- A non-null PII writer must share-lock the event before writing. The sweep
-- takes FOR UPDATE first, so either ordering leaves no PII behind the marker.
CREATE FUNCTION public.guard_o06_attendee_pii() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_marker timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.tenant_id, NEW.event_id)
      IS DISTINCT FROM (OLD.tenant_id, OLD.event_id) THEN
    RAISE EXCEPTION 'EVENT_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW.canonical_email IS NOT NULL THEN
    SELECT e.ticket_pii_anonymized_at INTO v_marker
    FROM public.events e WHERE e.tenant_id = NEW.tenant_id AND e.id = NEW.event_id
    FOR SHARE;
    IF FOUND AND v_marker IS NOT NULL THEN
      RAISE EXCEPTION 'EVENT_PII_ANONYMIZED' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER event_attendees_o06_pii_guard
  BEFORE INSERT OR UPDATE OF canonical_email, tenant_id, event_id ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.guard_o06_attendee_pii();
REVOKE ALL ON FUNCTION public.guard_o06_attendee_pii() FROM PUBLIC;
ALTER FUNCTION public.guard_o06_attendee_pii() OWNER TO migration_owner;

CREATE FUNCTION public.guard_o06_redemption_pii() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_marker timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.tenant_id, NEW.event_id)
      IS DISTINCT FROM (OLD.tenant_id, OLD.event_id) THEN
    RAISE EXCEPTION 'EVENT_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW.answers_json IS NOT NULL THEN
    SELECT e.ticket_pii_anonymized_at INTO v_marker
    FROM public.events e WHERE e.tenant_id = NEW.tenant_id AND e.id = NEW.event_id
    FOR SHARE;
    IF FOUND AND v_marker IS NOT NULL THEN
      RAISE EXCEPTION 'EVENT_PII_ANONYMIZED' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER redemption_requests_o06_pii_guard
  BEFORE INSERT OR UPDATE OF answers_json, tenant_id, event_id ON public.redemption_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_o06_redemption_pii();
REVOKE ALL ON FUNCTION public.guard_o06_redemption_pii() FROM PUBLIC;
ALTER FUNCTION public.guard_o06_redemption_pii() OWNER TO migration_owner;

CREATE FUNCTION public.guard_o06_purged_export() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.purged_at IS NOT NULL AND
     (NEW.purged_at IS DISTINCT FROM OLD.purged_at OR NEW.object_key IS NOT NULL
      OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'EXPORT_OBJECT_PURGED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER exports_o06_purged_guard BEFORE UPDATE ON public.exports
  FOR EACH ROW EXECUTE FUNCTION public.guard_o06_purged_export();
REVOKE ALL ON FUNCTION public.guard_o06_purged_export() FROM PUBLIC;
ALTER FUNCTION public.guard_o06_purged_export() OWNER TO migration_owner;

-- A claim locks the event before the export. The fence survives lease expiry.
CREATE OR REPLACE FUNCTION public.claim_expired_retention_objects(p_limit integer, p_lease_owner text)
RETURNS TABLE (tenant_id uuid, export_id uuid, object_key text, lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_event record; v_export record; v_claimed integer := 0; v_token uuid;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 20 THEN
    RAISE EXCEPTION 'invalid claim limit';
  END IF;
  IF p_lease_owner IS NULL OR length(p_lease_owner) < 1 OR length(p_lease_owner) > 128 THEN
    RAISE EXCEPTION 'invalid lease owner';
  END IF;
  FOR v_event IN
    SELECT e.tenant_id, e.id, e.ends_at FROM public.events e
    WHERE e.ends_at IS NOT NULL AND e.ends_at + interval '90 days' <= clock_timestamp()
      AND EXISTS (SELECT 1 FROM public.exports x
        WHERE x.tenant_id = e.tenant_id AND x.event_id = e.id
          AND x.status = 'READY' AND x.object_key IS NOT NULL AND x.purged_at IS NULL
          AND (x.object_purge_lease_expires_at IS NULL
               OR x.object_purge_lease_expires_at < clock_timestamp()))
    ORDER BY e.ends_at, e.tenant_id, e.id
    FOR UPDATE OF e SKIP LOCKED
  LOOP
    -- The event predicate is rechecked after the row lock is acquired.
    IF v_event.ends_at IS NULL OR v_event.ends_at + interval '90 days' > clock_timestamp() THEN
      CONTINUE;
    END IF;
    FOR v_export IN
      SELECT x.id, x.object_key, x.object_purge_lease_token FROM public.exports x
      WHERE x.tenant_id = v_event.tenant_id AND x.event_id = v_event.id
        AND x.status = 'READY' AND x.object_key IS NOT NULL AND x.purged_at IS NULL
        AND (x.object_purge_lease_expires_at IS NULL
             OR x.object_purge_lease_expires_at < clock_timestamp())
      ORDER BY x.id FOR UPDATE OF x SKIP LOCKED
    LOOP
      UPDATE public.events e SET export_retention_fenced_at = clock_timestamp()
      WHERE e.tenant_id = v_event.tenant_id AND e.id = v_event.id
        AND e.export_retention_fenced_at IS NULL;
      v_token := gen_random_uuid();
      UPDATE public.exports x SET object_purge_lease_owner = p_lease_owner,
        object_purge_lease_token = v_token,
        object_purge_lease_expires_at = clock_timestamp() + interval '120 seconds',
        updated_at = clock_timestamp()
      WHERE x.tenant_id = v_event.tenant_id AND x.id = v_export.id;
      IF v_export.object_purge_lease_token IS NOT NULL THEN
        INSERT INTO public.worker_job_reclaim_counters AS m (job_class, reclaim_count)
        VALUES ('process_export_object_retentions', 1)
        ON CONFLICT (job_class) DO UPDATE
          SET reclaim_count = m.reclaim_count + EXCLUDED.reclaim_count;
      END IF;
      tenant_id := v_event.tenant_id; export_id := v_export.id;
      object_key := v_export.object_key; lease_token := v_token;
      RETURN NEXT;
      v_claimed := v_claimed + 1;
      EXIT WHEN v_claimed >= p_limit;
    END LOOP;
    EXIT WHEN v_claimed >= p_limit;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_expired_retention_objects(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_expired_retention_objects(integer, text) TO ticket_runtime;
ALTER FUNCTION public.claim_expired_retention_objects(integer, text) OWNER TO migration_owner;

CREATE OR REPLACE FUNCTION public.apply_export_object_purge(
  p_tenant_id uuid, p_export_id uuid, p_lease_owner text, p_lease_token uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_event_id uuid; v_event record; v_export record;
BEGIN
  IF p_tenant_id IS NULL OR p_export_id IS NULL OR p_lease_token IS NULL
     OR p_lease_owner IS NULL OR length(p_lease_owner) < 1 OR length(p_lease_owner) > 128 THEN
    RAISE EXCEPTION 'invalid export purge claim';
  END IF;
  SELECT x.event_id INTO v_event_id FROM public.exports x
    WHERE x.tenant_id = p_tenant_id AND x.id = p_export_id;
  IF v_event_id IS NULL THEN RETURN false; END IF;
  SELECT e.ends_at, e.export_retention_fenced_at INTO v_event FROM public.events e
    WHERE e.tenant_id = p_tenant_id AND e.id = v_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.ends_at IS NULL OR v_event.export_retention_fenced_at IS NULL
     OR v_event.ends_at + interval '90 days' > clock_timestamp() THEN
    RETURN false;
  END IF;
  SELECT x.event_id, x.status, x.object_key, x.purged_at, x.object_purge_lease_owner,
         x.object_purge_lease_token, x.object_purge_lease_expires_at INTO v_export
    FROM public.exports x WHERE x.tenant_id = p_tenant_id AND x.id = p_export_id FOR UPDATE;
  IF NOT FOUND OR v_export.event_id <> v_event_id OR v_export.status <> 'READY'
     OR v_export.object_key IS NULL OR v_export.purged_at IS NOT NULL
     OR v_export.object_purge_lease_owner IS DISTINCT FROM p_lease_owner
     OR v_export.object_purge_lease_token IS DISTINCT FROM p_lease_token
     OR v_export.object_purge_lease_expires_at IS NULL
     OR v_export.object_purge_lease_expires_at <= clock_timestamp() THEN
    RETURN false;
  END IF;
  UPDATE public.exports x SET object_key = NULL, purged_at = clock_timestamp(),
    object_purge_lease_owner = NULL, object_purge_lease_token = NULL,
    object_purge_lease_expires_at = NULL, updated_at = clock_timestamp()
    WHERE x.tenant_id = p_tenant_id AND x.id = p_export_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_export_object_purge(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_export_object_purge(uuid, uuid, text, uuid) TO ticket_runtime;
ALTER FUNCTION public.apply_export_object_purge(uuid, uuid, text, uuid) OWNER TO migration_owner;

-- Aggregate queue telemetry only. No tenant, row key, or PII leaves this definer.
CREATE OR REPLACE FUNCTION public.worker_due_job_snapshot()
RETURNS TABLE (job_class text, oldest_due_age_seconds double precision,
               due_count integer, reclaim_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
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
  SELECT 'process_ticket_pii_anonymizations'::text,
    COALESCE(EXTRACT(EPOCH FROM clock_timestamp() - MIN(
      CASE WHEN e.business_status = 'CANCELLED' THEN e.cancelled_at ELSE e.ends_at END
      + interval '365 days')), 0)::float8,
    count(*)::integer, 0::bigint
  FROM public.events e
  WHERE e.ends_at IS NOT NULL AND e.ticket_pii_anonymized_at IS NULL
    AND (CASE WHEN e.business_status = 'CANCELLED' THEN e.cancelled_at ELSE e.ends_at END)
      + interval '365 days' <= clock_timestamp()
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
  SELECT 'process_export_object_retentions'::text,
    COALESCE(EXTRACT(EPOCH FROM clock_timestamp() - MIN(e.ends_at + interval '90 days')), 0)::float8,
    count(*)::integer,
    COALESCE((SELECT m.reclaim_count FROM public.worker_job_reclaim_counters m
              WHERE m.job_class = 'process_export_object_retentions'), 0)
  FROM public.exports x JOIN public.events e
    ON e.tenant_id = x.tenant_id AND e.id = x.event_id
  WHERE x.status = 'READY' AND x.object_key IS NOT NULL AND x.purged_at IS NULL
    AND e.ends_at IS NOT NULL AND e.ends_at + interval '90 days' <= clock_timestamp()
    AND (x.object_purge_lease_expires_at IS NULL
      OR x.object_purge_lease_expires_at < clock_timestamp())
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
