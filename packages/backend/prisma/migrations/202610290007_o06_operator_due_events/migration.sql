-- F01: operator-only discovery. The predicate scans existing rows as well as
-- new rows, so events already overdue when this migration runs need no backfill.
-- A missing export row is not proof of an empty object prefix.
CREATE FUNCTION public.list_export_retention_due_events(
  p_as_of timestamptz, p_limit integer,
  p_after_deadline timestamptz DEFAULT NULL,
  p_after_tenant uuid DEFAULT NULL,
  p_after_event uuid DEFAULT NULL
) RETURNS TABLE (
  tenant_id uuid, event_id uuid, deadline timestamptz,
  deadline_cursor text,
  barrier_generation uuid, fenced_at timestamptz,
  inventory_recorded_at timestamptz, unpurged_count bigint,
  completed boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_as_of IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 500 OR
     ((p_after_deadline IS NULL)::integer +
      (p_after_tenant IS NULL)::integer +
      (p_after_event IS NULL)::integer) NOT IN (0, 3) THEN
    RAISE EXCEPTION 'invalid retention due-event page';
  END IF;
  RETURN QUERY
  SELECT e.tenant_id, e.id, e.ends_at + interval '90 days',
    to_char((e.ends_at + interval '90 days') AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    e.export_retention_barrier_generation, e.export_retention_fenced_at,
    e.export_retention_inventory_recorded_at,
    (SELECT count(*) FROM public.exports x
      WHERE x.tenant_id = e.tenant_id AND x.event_id = e.id
        AND x.purged_at IS NULL),
    e.export_retention_inventory_recorded_at IS NOT NULL AND
      NOT EXISTS (SELECT 1 FROM public.exports x
        WHERE x.tenant_id = e.tenant_id AND x.event_id = e.id
          AND x.purged_at IS NULL)
  FROM public.events e
  WHERE e.ends_at IS NOT NULL
    AND e.ends_at + interval '89 days' <= p_as_of
    AND (p_after_deadline IS NULL OR
      (e.ends_at + interval '90 days', e.tenant_id, e.id) >
        (p_after_deadline, p_after_tenant, p_after_event))
  ORDER BY e.ends_at + interval '90 days', e.tenant_id, e.id
  LIMIT p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.list_export_retention_due_events(
  timestamptz, integer, timestamptz, uuid, uuid) FROM PUBLIC;
ALTER FUNCTION public.list_export_retention_due_events(
  timestamptz, integer, timestamptz, uuid, uuid) OWNER TO migration_owner;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'ticket_retention_operator') THEN
    GRANT EXECUTE ON FUNCTION public.list_export_retention_due_events(
      timestamptz, integer, timestamptz, uuid, uuid) TO ticket_retention_operator;
  END IF;
END $$;
