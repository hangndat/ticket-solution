-- F-BE / C-F: form/consent snapshots, pending expiry/caps.
-- max_tickets_per_attendee already added by E-BE (202610170010).
-- Legacy requests keep null consent (never fabricate).

ALTER TABLE issuance_sources
  ADD COLUMN pending_ttl_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN max_pending_per_user integer NOT NULL DEFAULT 5;

ALTER TABLE issuance_sources
  ADD CONSTRAINT issuance_sources_pending_ttl_chk
  CHECK (pending_ttl_hours > 0 AND pending_ttl_hours <= 8760),
  ADD CONSTRAINT issuance_sources_max_pending_chk
  CHECK (max_pending_per_user > 0 AND max_pending_per_user <= 100);

ALTER TABLE redemption_requests
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN answers_json jsonb,
  ADD COLUMN terms_accepted boolean,
  ADD COLUMN consent_accepted_at timestamptz,
  ADD COLUMN form_definition_hash text,
  ADD COLUMN terms_content_hash text,
  ADD COLUMN decided_at timestamptz;

COMMENT ON COLUMN redemption_requests.terms_accepted IS
  'Explicit consent evidence. NULL = legacy/no fabricated consent.';

COMMENT ON COLUMN redemption_requests.consent_accepted_at IS
  'Server DB clock at accept; never client-supplied.';

COMMENT ON COLUMN redemption_requests.answers_json IS
  'Immutable normalized answers snapshot; never copied into audit_logs.';

-- Staff pending cursor + worker expiry scans.
CREATE INDEX redemption_requests_pending_expires_idx
  ON redemption_requests (tenant_id, event_id, expires_at)
  WHERE status = 'PENDING_REVIEW';

CREATE INDEX redemption_requests_actor_pending_idx
  ON redemption_requests (tenant_id, event_id, actor_user_id)
  WHERE status = 'PENDING_REVIEW';

CREATE INDEX redemption_requests_pending_created_idx
  ON redemption_requests (tenant_id, event_id, created_at, id)
  WHERE status = 'PENDING_REVIEW';

-- Cross-tenant due list for worker (envelope only — no answers/PII).
CREATE OR REPLACE FUNCTION list_due_pending_redemptions(p_limit integer)
RETURNS TABLE (
  tenant_id uuid,
  event_id uuid,
  request_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 THEN
    RAISE EXCEPTION 'invalid claim limit';
  END IF;
  RETURN QUERY
  SELECT r.tenant_id, r.event_id, r.id
  FROM public.redemption_requests r
  WHERE r.status = 'PENDING_REVIEW'
    AND r.expires_at IS NOT NULL
    AND r.expires_at <= clock_timestamp()
  ORDER BY r.expires_at ASC, r.id ASC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION list_due_pending_redemptions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_due_pending_redemptions(integer) TO ticket_runtime;
