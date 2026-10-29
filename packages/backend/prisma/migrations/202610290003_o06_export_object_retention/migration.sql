-- O06 POL-03: export object purge after event business expiry + 90 days.
-- SQL claims and records deletion only; the worker deletes bytes from object storage.
ALTER TABLE public.exports
  ADD COLUMN purged_at timestamptz,
  ADD COLUMN object_purge_lease_owner text,
  ADD COLUMN object_purge_lease_token uuid,
  ADD COLUMN object_purge_lease_expires_at timestamptz;

CREATE INDEX exports_object_purge_claim_idx ON public.exports (tenant_id, event_id)
  WHERE status = 'READY' AND object_key IS NOT NULL AND purged_at IS NULL;
CREATE INDEX events_export_object_expiry_idx ON public.events (ends_at)
  WHERE ends_at IS NOT NULL;

CREATE FUNCTION public.claim_expired_retention_objects(p_limit integer, p_lease_owner text)
RETURNS TABLE (tenant_id uuid, export_id uuid, object_key text, lease_token uuid)
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
    SELECT x.tenant_id, x.id
    FROM public.exports x
    JOIN public.events e ON e.tenant_id = x.tenant_id AND e.id = x.event_id
    WHERE x.status = 'READY' AND x.object_key IS NOT NULL AND x.purged_at IS NULL
      AND e.ends_at IS NOT NULL
      AND e.ends_at + interval '90 days' <= clock_timestamp()
      AND (x.object_purge_lease_expires_at IS NULL
           OR x.object_purge_lease_expires_at < clock_timestamp())
    ORDER BY e.ends_at, x.tenant_id, x.id
    FOR UPDATE OF x SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.exports x
    SET object_purge_lease_owner = p_lease_owner,
        object_purge_lease_token = gen_random_uuid(),
        object_purge_lease_expires_at = clock_timestamp() + interval '120 seconds',
        updated_at = clock_timestamp()
    FROM candidates c
    WHERE x.tenant_id = c.tenant_id AND x.id = c.id
    RETURNING x.tenant_id, x.id, x.object_key, x.object_purge_lease_token
  )
  SELECT c.tenant_id, c.id, c.object_key, c.object_purge_lease_token FROM claimed c;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_expired_retention_objects(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_expired_retention_objects(integer, text) TO ticket_runtime;
ALTER FUNCTION public.claim_expired_retention_objects(integer, text) OWNER TO migration_owner;

CREATE FUNCTION public.apply_export_object_purge(
  p_tenant_id uuid, p_export_id uuid, p_lease_owner text, p_lease_token uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_count integer;
BEGIN
  IF p_tenant_id IS NULL OR p_export_id IS NULL OR p_lease_token IS NULL
     OR p_lease_owner IS NULL OR length(p_lease_owner) < 1 OR length(p_lease_owner) > 128 THEN
    RAISE EXCEPTION 'invalid export purge claim';
  END IF;

  UPDATE public.exports x
  SET object_key = NULL,
      purged_at = clock_timestamp(),
      object_purge_lease_owner = NULL,
      object_purge_lease_token = NULL,
      object_purge_lease_expires_at = NULL,
      updated_at = clock_timestamp()
  WHERE x.tenant_id = p_tenant_id AND x.id = p_export_id
    AND x.status = 'READY' AND x.object_key IS NOT NULL AND x.purged_at IS NULL
    AND x.object_purge_lease_owner = p_lease_owner
    AND x.object_purge_lease_token = p_lease_token;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_export_object_purge(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_export_object_purge(uuid, uuid, text, uuid) TO ticket_runtime;
ALTER FUNCTION public.apply_export_object_purge(uuid, uuid, text, uuid) OWNER TO migration_owner;
