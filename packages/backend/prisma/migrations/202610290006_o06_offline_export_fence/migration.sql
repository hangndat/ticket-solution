-- F01: fail closed until a separate operator has stopped all writers and
-- attested an empty version/multipart inventory. This migration does not prove
-- the external barrier. Provision ticket_retention_operator NOLOGIN NOBYPASSRLS
-- before migration; grant it only to a separately controlled ops principal.

ALTER TABLE public.events
  ADD COLUMN export_retention_barrier_generation uuid,
  ADD COLUMN export_retention_inventory_evidence jsonb,
  ADD COLUMN export_retention_inventory_recorded_at timestamptz;

-- The online worker must not be able to claim/delete/finalize any more objects.
REVOKE ALL ON FUNCTION public.claim_expired_retention_objects(integer, text)
  FROM PUBLIC, ticket_runtime;
REVOKE ALL ON FUNCTION public.apply_export_object_purge(uuid, uuid, text, uuid)
  FROM PUBLIC, ticket_runtime;
CREATE OR REPLACE FUNCTION public.claim_expired_retention_objects(
  p_limit integer, p_lease_owner text
) RETURNS TABLE (tenant_id uuid, export_id uuid, object_key text, lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'EXPORT_RETENTION_OFFLINE_BARRIER_REQUIRED' USING ERRCODE = '55000';
END;
$$;
CREATE OR REPLACE FUNCTION public.apply_export_object_purge(
  p_tenant_id uuid, p_export_id uuid, p_lease_owner text, p_lease_token uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'EXPORT_RETENTION_OFFLINE_BARRIER_REQUIRED' USING ERRCODE = '55000';
END;
$$;

-- Prevent runtime SQL from setting a fence or purge marker directly. Definer
-- functions below execute as migration_owner under the existing FORCE RLS policies.
CREATE OR REPLACE FUNCTION public.guard_o06_event_clocks() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF current_user <> 'migration_owner' AND (
    NEW.export_retention_fenced_at IS DISTINCT FROM OLD.export_retention_fenced_at OR
    NEW.export_retention_barrier_generation IS DISTINCT FROM OLD.export_retention_barrier_generation OR
    NEW.export_retention_inventory_evidence IS DISTINCT FROM OLD.export_retention_inventory_evidence OR
    NEW.export_retention_inventory_recorded_at IS DISTINCT FROM OLD.export_retention_inventory_recorded_at
  ) THEN
    RAISE EXCEPTION 'EVENT_RETENTION_OPERATOR_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF OLD.ticket_pii_anonymized_at IS NOT NULL AND (
    NEW.ticket_pii_anonymized_at IS DISTINCT FROM OLD.ticket_pii_anonymized_at OR
    NEW.ends_at IS DISTINCT FROM OLD.ends_at OR
    NEW.business_status IS DISTINCT FROM OLD.business_status OR
    NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
  ) THEN
    RAISE EXCEPTION 'EVENT_RETENTION_FENCED' USING ERRCODE = '23514';
  END IF;
  IF OLD.export_retention_fenced_at IS NOT NULL AND (
    NEW.export_retention_fenced_at IS DISTINCT FROM OLD.export_retention_fenced_at OR
    NEW.ends_at IS DISTINCT FROM OLD.ends_at OR
    (OLD.export_retention_barrier_generation IS NOT NULL AND
      NEW.export_retention_barrier_generation IS DISTINCT FROM OLD.export_retention_barrier_generation) OR
    (OLD.export_retention_inventory_recorded_at IS NOT NULL AND
      NEW.export_retention_inventory_evidence IS DISTINCT FROM OLD.export_retention_inventory_evidence)
  ) THEN
    RAISE EXCEPTION 'EVENT_RETENTION_FENCED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_o06_purged_export() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (NEW.tenant_id, NEW.event_id) IS DISTINCT FROM (OLD.tenant_id, OLD.event_id) THEN
    RAISE EXCEPTION 'EXPORT_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF current_user <> 'migration_owner' AND NEW.purged_at IS DISTINCT FROM OLD.purged_at THEN
    RAISE EXCEPTION 'EXPORT_RETENTION_OPERATOR_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF OLD.purged_at IS NOT NULL AND (
    NEW.purged_at IS DISTINCT FROM OLD.purged_at OR NEW.object_key IS NOT NULL OR
    NEW.status IS DISTINCT FROM OLD.status
  ) THEN
    RAISE EXCEPTION 'EXPORT_OBJECT_PURGED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- Claims take the event lock before export rows, including reclaimed jobs.
DROP FUNCTION public.claim_exports_batch(integer, text);
CREATE FUNCTION public.claim_exports_batch(
  p_limit integer, p_lease_owner text, p_ttl_seconds integer
) RETURNS TABLE (export_id uuid, tenant_id uuid, event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_event record; v_export record; v_count integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 20 OR
     p_lease_owner IS NULL OR length(p_lease_owner) < 1 OR length(p_lease_owner) > 128 OR
     p_ttl_seconds IS NULL OR p_ttl_seconds < 60 OR p_ttl_seconds > 604800 THEN
    RAISE EXCEPTION 'invalid export claim';
  END IF;
  FOR v_event IN
    SELECT e.tenant_id, e.id, e.ends_at, e.export_retention_fenced_at
    FROM public.events e
    WHERE e.export_retention_fenced_at IS NULL
      AND (e.ends_at IS NULL OR
        clock_timestamp() + p_ttl_seconds * interval '1 second' + interval '24 hours'
          < e.ends_at + interval '90 days')
      AND EXISTS (SELECT 1 FROM public.exports x
        WHERE x.tenant_id = e.tenant_id AND x.event_id = e.id
          AND (x.status = 'PENDING' OR
            (x.status = 'PROCESSING' AND x.lease_expires_at < clock_timestamp())))
    ORDER BY e.tenant_id, e.id FOR UPDATE OF e SKIP LOCKED
  LOOP
    IF v_event.export_retention_fenced_at IS NOT NULL OR
       (v_event.ends_at IS NOT NULL AND
        clock_timestamp() + p_ttl_seconds * interval '1 second' + interval '24 hours'
          >= v_event.ends_at + interval '90 days') THEN
      CONTINUE;
    END IF;
    FOR v_export IN
      SELECT x.id, x.status FROM public.exports x
      WHERE x.tenant_id = v_event.tenant_id AND x.event_id = v_event.id
        AND (x.status = 'PENDING' OR
          (x.status = 'PROCESSING' AND x.lease_expires_at < clock_timestamp()))
      ORDER BY x.created_at, x.id FOR UPDATE OF x SKIP LOCKED
    LOOP
      UPDATE public.exports x SET status = 'PROCESSING', lease_owner = p_lease_owner,
        lease_expires_at = clock_timestamp() + interval '120 seconds',
        updated_at = clock_timestamp()
      WHERE x.tenant_id = v_event.tenant_id AND x.id = v_export.id;
      IF v_export.status = 'PROCESSING' THEN
        INSERT INTO public.worker_job_reclaim_counters AS m (job_class, reclaim_count)
        VALUES ('relay_exports', 1) ON CONFLICT (job_class) DO UPDATE
          SET reclaim_count = m.reclaim_count + EXCLUDED.reclaim_count;
      END IF;
      export_id := v_export.id; tenant_id := v_event.tenant_id; event_id := v_event.id;
      RETURN NEXT;
      v_count := v_count + 1;
      EXIT WHEN v_count >= p_limit;
    END LOOP;
    EXIT WHEN v_count >= p_limit;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_exports_batch(integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_exports_batch(integer, text, integer) TO ticket_runtime;
ALTER FUNCTION public.claim_exports_batch(integer, text, integer) OWNER TO migration_owner;

CREATE FUNCTION public.fence_export_retention_event(
  p_tenant_id uuid, p_event_id uuid, p_generation uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_event record;
BEGIN
  IF p_tenant_id IS NULL OR p_event_id IS NULL OR p_generation IS NULL THEN
    RAISE EXCEPTION 'invalid retention fence';
  END IF;
  SELECT e.ends_at, e.export_retention_fenced_at, e.export_retention_barrier_generation
    INTO v_event FROM public.events e
    WHERE e.tenant_id = p_tenant_id AND e.id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.ends_at IS NULL OR
     v_event.ends_at + interval '89 days' > clock_timestamp() THEN RETURN false; END IF;
  IF v_event.export_retention_barrier_generation IS NOT NULL THEN
    RETURN v_event.export_retention_barrier_generation = p_generation;
  END IF;
  UPDATE public.events SET
    export_retention_fenced_at = COALESCE(export_retention_fenced_at, clock_timestamp()),
    export_retention_barrier_generation = p_generation
  WHERE tenant_id = p_tenant_id AND id = p_event_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.fence_export_retention_event(uuid, uuid, uuid) FROM PUBLIC;
ALTER FUNCTION public.fence_export_retention_event(uuid, uuid, uuid) OWNER TO migration_owner;

-- Evidence is an operator attestation. It is not a database proof of MinIO state.
CREATE FUNCTION public.record_export_retention_inventory(
  p_tenant_id uuid, p_event_id uuid, p_generation uuid, p_evidence jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_event record;
BEGIN
  IF p_tenant_id IS NULL OR p_event_id IS NULL OR p_generation IS NULL OR
     p_evidence IS NULL OR p_evidence->>'emptyInventory' IS DISTINCT FROM 'true' OR
     COALESCE(p_evidence->>'writerExitHash', '') !~ '^[0-9a-f]{64}$' OR
     COALESCE(p_evidence->>'serverBarrierHash', '') !~ '^[0-9a-f]{64}$' OR
     COALESCE(p_evidence->>'inventoryHash', '') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid retention inventory attestation';
  END IF;
  SELECT e.ends_at, e.export_retention_fenced_at,
    e.export_retention_barrier_generation, e.export_retention_inventory_evidence
    INTO v_event FROM public.events e
    WHERE e.tenant_id = p_tenant_id AND e.id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.ends_at IS NULL OR
     v_event.ends_at + interval '89 days' > clock_timestamp() OR
     v_event.export_retention_fenced_at IS NULL OR
     v_event.export_retention_barrier_generation IS DISTINCT FROM p_generation THEN
    RETURN false;
  END IF;
  IF v_event.export_retention_inventory_evidence IS NOT NULL THEN
    RETURN v_event.export_retention_inventory_evidence = p_evidence;
  END IF;
  UPDATE public.events SET export_retention_inventory_evidence = p_evidence,
    export_retention_inventory_recorded_at = clock_timestamp()
  WHERE tenant_id = p_tenant_id AND id = p_event_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_export_retention_inventory(uuid, uuid, uuid, jsonb) FROM PUBLIC;
ALTER FUNCTION public.record_export_retention_inventory(uuid, uuid, uuid, jsonb) OWNER TO migration_owner;

CREATE FUNCTION public.finalize_export_retention_event(
  p_tenant_id uuid, p_event_id uuid, p_generation uuid
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_event record; v_count integer;
BEGIN
  IF p_tenant_id IS NULL OR p_event_id IS NULL OR p_generation IS NULL THEN
    RAISE EXCEPTION 'invalid retention finalization';
  END IF;
  SELECT e.ends_at, e.export_retention_fenced_at,
    e.export_retention_barrier_generation, e.export_retention_inventory_evidence,
    e.export_retention_inventory_recorded_at INTO v_event
  FROM public.events e WHERE e.tenant_id = p_tenant_id AND e.id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.ends_at IS NULL OR
     v_event.ends_at + interval '89 days' > clock_timestamp() OR
     v_event.export_retention_fenced_at IS NULL OR
     v_event.export_retention_barrier_generation IS DISTINCT FROM p_generation OR
     v_event.export_retention_inventory_recorded_at IS NULL OR
     v_event.export_retention_inventory_evidence->>'emptyInventory' IS DISTINCT FROM 'true' THEN
    RETURN 0;
  END IF;
  -- Lock every export after the event so the lease check and update are atomic.
  PERFORM x.id FROM public.exports x
    WHERE x.tenant_id = p_tenant_id AND x.event_id = p_event_id
    ORDER BY x.id FOR UPDATE OF x;
  IF EXISTS (SELECT 1 FROM public.exports x
    WHERE x.tenant_id = p_tenant_id AND x.event_id = p_event_id AND
      ((x.lease_expires_at IS NOT NULL AND x.lease_expires_at > clock_timestamp()) OR
       (x.object_purge_lease_expires_at IS NOT NULL AND
        x.object_purge_lease_expires_at > clock_timestamp()))) THEN RETURN 0; END IF;
  UPDATE public.exports x SET object_key = NULL, purged_at = clock_timestamp(),
    status = CASE WHEN x.status IN ('PENDING', 'PROCESSING') THEN 'FAILED' ELSE x.status END,
    error_code = CASE WHEN x.status IN ('PENDING', 'PROCESSING')
      THEN 'EXPORT_EXPIRED' ELSE x.error_code END,
    lease_owner = NULL, lease_expires_at = NULL,
    object_purge_lease_owner = NULL, object_purge_lease_token = NULL,
    object_purge_lease_expires_at = NULL, updated_at = clock_timestamp()
  WHERE x.tenant_id = p_tenant_id AND x.event_id = p_event_id AND x.purged_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_export_retention_event(uuid, uuid, uuid) FROM PUBLIC;
ALTER FUNCTION public.finalize_export_retention_event(uuid, uuid, uuid) OWNER TO migration_owner;

-- Narrow operator readback; runtime has no EXECUTE grant and direct event RLS
-- remains closed. This distinguishes a successful zero-row finalization from
-- a blocked active lease without exposing other tenants' rows.
CREATE FUNCTION public.export_retention_operator_status(
  p_tenant_id uuid, p_event_id uuid, p_generation uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_event record; v_pending bigint; v_active bigint;
BEGIN
  IF p_tenant_id IS NULL OR p_event_id IS NULL OR p_generation IS NULL THEN
    RAISE EXCEPTION 'invalid retention status';
  END IF;
  SELECT e.export_retention_fenced_at, e.export_retention_barrier_generation,
    e.export_retention_inventory_recorded_at INTO v_event
  FROM public.events e WHERE e.tenant_id = p_tenant_id AND e.id = p_event_id;
  IF NOT FOUND OR v_event.export_retention_barrier_generation IS DISTINCT FROM p_generation THEN
    RETURN jsonb_build_object('matched', false);
  END IF;
  SELECT count(*) FILTER (WHERE x.purged_at IS NULL),
    count(*) FILTER (WHERE
      (x.lease_expires_at IS NOT NULL AND x.lease_expires_at > clock_timestamp()) OR
      (x.object_purge_lease_expires_at IS NOT NULL AND
        x.object_purge_lease_expires_at > clock_timestamp()))
    INTO v_pending, v_active FROM public.exports x
  WHERE x.tenant_id = p_tenant_id AND x.event_id = p_event_id;
  RETURN jsonb_build_object(
    'matched', true,
    'fenced', v_event.export_retention_fenced_at IS NOT NULL,
    'inventoryRecorded', v_event.export_retention_inventory_recorded_at IS NOT NULL,
    'unpurgedCount', v_pending,
    'activeLeaseCount', v_active
  );
END;
$$;
REVOKE ALL ON FUNCTION public.export_retention_operator_status(uuid, uuid, uuid) FROM PUBLIC;
ALTER FUNCTION public.export_retention_operator_status(uuid, uuid, uuid) OWNER TO migration_owner;

-- Test harnesses that have not provisioned the ops role remain fail closed.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'ticket_retention_operator') THEN
    GRANT EXECUTE ON FUNCTION public.fence_export_retention_event(uuid, uuid, uuid)
      TO ticket_retention_operator;
    GRANT EXECUTE ON FUNCTION public.record_export_retention_inventory(uuid, uuid, uuid, jsonb)
      TO ticket_retention_operator;
    GRANT EXECUTE ON FUNCTION public.finalize_export_retention_event(uuid, uuid, uuid)
      TO ticket_retention_operator;
    GRANT EXECUTE ON FUNCTION public.export_retention_operator_status(uuid, uuid, uuid)
      TO ticket_retention_operator;
  END IF;
END $$;
