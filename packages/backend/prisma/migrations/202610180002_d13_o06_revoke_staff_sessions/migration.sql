-- D13 / SEC-1: revoke staff Gate sessions atomically with O06 account anonymize.
-- Forward plan (IdP / SEC-2): keep session revoke inside apply_account_anonymization;
-- a later IdP erase worker must call this function (or share the same revoke block)
-- and must not REPLACE the function without preserving staff_sessions revocation.

-- Owner policy so SECURITY DEFINER (migration_owner, FORCE RLS) can revoke sessions
-- across tenants for the anonymized user_id (no app.tenant_id set in worker path).
DROP POLICY IF EXISTS staff_sessions_owner ON staff_sessions;
CREATE POLICY staff_sessions_owner ON staff_sessions TO migration_owner
  USING (true)
  WITH CHECK (true);

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

  -- Staff Gate sessions (SEC-1): same transaction as COMPLETED — no live window after apply.
  UPDATE public.staff_sessions s
  SET status = 'REVOKED',
      revoked_at = clock_timestamp()
  WHERE s.user_id = v_user_id
    AND s.status = 'ACTIVE';

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
  -- Explicit non-goals (SEC-2): do not erase/disable IdP subjects here.

  RETURN QUERY SELECT p_request_id, v_user_id, true;
END;
$$;

REVOKE ALL ON FUNCTION apply_account_anonymization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_account_anonymization(uuid) TO ticket_runtime;
ALTER FUNCTION apply_account_anonymization(uuid) OWNER TO migration_owner;
