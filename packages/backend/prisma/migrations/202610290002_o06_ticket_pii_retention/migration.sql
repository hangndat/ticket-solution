-- O06 POL-02: event-scoped PII anonymization after 365 days.
-- The event row is retained as the idempotency marker; aggregate rows are never deleted.
ALTER TABLE public.events
  ADD COLUMN ticket_pii_anonymized_at timestamptz;

CREATE INDEX events_ticket_pii_retention_due_idx
  ON public.events (ends_at, cancelled_at)
  WHERE ends_at IS NOT NULL AND ticket_pii_anonymized_at IS NULL;

-- Existing owner SELECT policy only exposes expired PENDING_REVIEW rows.
-- The definer needs all event-scoped rows to clear answers_json, including ISSUED.
CREATE POLICY redemption_requests_retention_owner ON public.redemption_requests
  FOR ALL TO migration_owner USING (true) WITH CHECK (true);

CREATE FUNCTION public.list_due_ticket_pii_anonymizations(p_limit integer)
RETURNS TABLE (tenant_id uuid, event_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 THEN
    RAISE EXCEPTION 'invalid claim limit';
  END IF;

  RETURN QUERY
  SELECT e.tenant_id, e.id
  FROM public.events e
  WHERE e.ends_at IS NOT NULL
    AND e.ticket_pii_anonymized_at IS NULL
    AND (CASE WHEN e.business_status = 'CANCELLED'
              THEN e.cancelled_at ELSE e.ends_at END) + interval '365 days'
        <= clock_timestamp()
  ORDER BY CASE WHEN e.business_status = 'CANCELLED'
                THEN e.cancelled_at ELSE e.ends_at END, e.tenant_id, e.id
  FOR UPDATE OF e SKIP LOCKED
  LIMIT p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.list_due_ticket_pii_anonymizations(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_due_ticket_pii_anonymizations(integer) TO ticket_runtime;
ALTER FUNCTION public.list_due_ticket_pii_anonymizations(integer) OWNER TO migration_owner;

CREATE FUNCTION public.apply_ticket_pii_anonymization(p_tenant_id uuid, p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_clock timestamptz;
  v_done timestamptz;
BEGIN
  IF p_tenant_id IS NULL OR p_event_id IS NULL THEN
    RAISE EXCEPTION 'invalid event identity';
  END IF;

  SELECT CASE WHEN e.ends_at IS NULL THEN NULL
              WHEN e.business_status = 'CANCELLED' THEN e.cancelled_at
              ELSE e.ends_at END,
         e.ticket_pii_anonymized_at
    INTO v_clock, v_done
  FROM public.events e
  WHERE e.tenant_id = p_tenant_id AND e.id = p_event_id
  FOR UPDATE;

  IF NOT FOUND OR v_done IS NOT NULL OR v_clock IS NULL
     OR v_clock + interval '365 days' > clock_timestamp() THEN
    RETURN false;
  END IF;

  UPDATE public.event_attendees a
  SET canonical_email = NULL, updated_at = clock_timestamp()
  WHERE a.tenant_id = p_tenant_id AND a.event_id = p_event_id
    AND a.canonical_email IS NOT NULL;

  UPDATE public.redemption_requests r
  SET answers_json = NULL, updated_at = clock_timestamp()
  WHERE r.tenant_id = p_tenant_id AND r.event_id = p_event_id
    AND r.answers_json IS NOT NULL;

  UPDATE public.events e
  SET ticket_pii_anonymized_at = clock_timestamp()
  WHERE e.tenant_id = p_tenant_id AND e.id = p_event_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_ticket_pii_anonymization(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_ticket_pii_anonymization(uuid, uuid) TO ticket_runtime;
ALTER FUNCTION public.apply_ticket_pii_anonymization(uuid, uuid) OWNER TO migration_owner;
