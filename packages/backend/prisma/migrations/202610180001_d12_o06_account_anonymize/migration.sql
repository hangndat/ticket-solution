-- D12 / O06: account deletion anonymize pipeline (≤30d SLA).
-- Worker claims due REQUESTED rows via narrow SECURITY DEFINER helpers.
-- Does NOT hard-delete audit_logs / platform_audit_logs (TTL 730d).

-- Owner policy so SECURITY DEFINER (migration_owner, FORCE RLS) can clear attendee PII.
DROP POLICY IF EXISTS event_attendees_owner ON event_attendees;
CREATE POLICY event_attendees_owner ON event_attendees TO migration_owner
  USING (true)
  WITH CHECK (true);

-- List open deletion requests accepted under O06 and due for anonymize.
-- Due = requested_at reached (process immediately; SLA deadline is ≤30 days).
CREATE OR REPLACE FUNCTION list_due_account_anonymizations(p_limit integer)
RETURNS TABLE (
  out_request_id uuid,
  out_user_id uuid
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
  SELECT r.id, r.user_id
  FROM public.account_deletion_requests r
  WHERE r.state = 'REQUESTED'
    AND r.policy_version IS NOT NULL
    AND r.requested_at <= clock_timestamp()
  ORDER BY r.requested_at ASC, r.id ASC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION list_due_account_anonymizations(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_due_account_anonymizations(integer) TO ticket_runtime;
ALTER FUNCTION list_due_account_anonymizations(integer) OWNER TO migration_owner;

-- Apply one anonymization: scrub identity PII, revoke devices, complete request.
-- Preserves users.id for FK integrity; never DELETE audit rows.
CREATE OR REPLACE FUNCTION apply_account_anonymization(p_request_id uuid)
RETURNS TABLE (
  out_request_id uuid,
  out_user_id uuid,
  out_applied boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid;
  v_state text;
  v_policy text;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid request id';
  END IF;

  SELECT r.user_id, r.state, r.policy_version
    INTO v_user_id, v_state, v_policy
  FROM public.account_deletion_requests r
  WHERE r.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_request_id, NULL::uuid, false;
    RETURN;
  END IF;

  IF v_state = 'COMPLETED' THEN
    RETURN QUERY SELECT p_request_id, v_user_id, false;
    RETURN;
  END IF;

  IF v_state <> 'REQUESTED' OR v_policy IS NULL THEN
    RAISE EXCEPTION 'account deletion not eligible for anonymize';
  END IF;

  -- Identity: clear email; rotate subject so OIDC subject can re-register.
  UPDATE public.users u
  SET email = NULL,
      email_verified = false,
      subject = 'anon:' || p_request_id::text,
      updated_at = clock_timestamp()
  WHERE u.id = v_user_id;

  -- Push tokens
  UPDATE public.device_tokens d
  SET revoked_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE d.user_id = v_user_id
    AND d.revoked_at IS NULL;

  -- Event-scoped attendee email projection (keep row/aggregates)
  UPDATE public.event_attendees ea
  SET canonical_email = NULL,
      updated_at = clock_timestamp()
  WHERE ea.user_id = v_user_id
    AND ea.canonical_email IS NOT NULL;

  UPDATE public.account_deletion_requests r
  SET state = 'COMPLETED',
      updated_at = clock_timestamp()
  WHERE r.id = p_request_id;

  -- Explicit non-goals (O06): do not DELETE FROM audit_logs / platform_audit_logs.

  RETURN QUERY SELECT p_request_id, v_user_id, true;
END;
$$;

REVOKE ALL ON FUNCTION apply_account_anonymization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_account_anonymization(uuid) TO ticket_runtime;
ALTER FUNCTION apply_account_anonymization(uuid) OWNER TO migration_owner;
