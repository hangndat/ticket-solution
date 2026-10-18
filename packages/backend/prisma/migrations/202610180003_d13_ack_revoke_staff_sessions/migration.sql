-- D13 / SEC-1 ACK: revoke staff Gate sessions atomically when account deletion is ACK'd.
-- Architect D1 (docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md §4):
--   helper revoke_sessions_for_user SECURITY DEFINER; call at ACK + apply (idempotent).
-- REJECTED must NOT restore sessions (R5). openStaffSession denied while request open.
-- Race: advisory xact lock serializes ACK revoke vs session open (trigger = defense-in-depth).
-- IdP / SEC-2 unchanged (architect revision in flight).

-- Namespace 872341 = account-deletion session mutation (int4 + hashtext(user_id)).
CREATE OR REPLACE FUNCTION lock_user_session_mutation(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid user id';
  END IF;
  PERFORM pg_advisory_xact_lock(872341, hashtext(p_user_id::text));
END;
$$;

REVOKE ALL ON FUNCTION lock_user_session_mutation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lock_user_session_mutation(uuid) TO ticket_runtime;
ALTER FUNCTION lock_user_session_mutation(uuid) OWNER TO migration_owner;

-- Revoke every ACTIVE staff_sessions row for the user across tenants (idempotent).
CREATE OR REPLACE FUNCTION revoke_sessions_for_user(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid user id';
  END IF;

  PERFORM public.lock_user_session_mutation(p_user_id);

  UPDATE public.staff_sessions s
  SET status = 'REVOKED',
      revoked_at = clock_timestamp()
  WHERE s.user_id = p_user_id
    AND s.status = 'ACTIVE';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION revoke_sessions_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revoke_sessions_for_user(uuid) TO ticket_runtime;
ALTER FUNCTION revoke_sessions_for_user(uuid) OWNER TO migration_owner;

-- Fail-closed: cannot open a new Gate session while deletion is open.
CREATE OR REPLACE FUNCTION assert_can_open_staff_session(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid user id';
  END IF;

  PERFORM public.lock_user_session_mutation(p_user_id);

  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_requests r
    WHERE r.user_id = p_user_id
      AND r.state IN ('REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY')
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETION_OPEN'
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION assert_can_open_staff_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assert_can_open_staff_session(uuid) TO ticket_runtime;
ALTER FUNCTION assert_can_open_staff_session(uuid) OWNER TO migration_owner;

-- Defense-in-depth: raw INSERT cannot bypass the open-deletion check.
CREATE OR REPLACE FUNCTION staff_sessions_deny_if_deletion_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_requests r
    WHERE r.user_id = NEW.user_id
      AND r.state IN ('REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY')
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETION_OPEN'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_sessions_deny_if_deletion_open ON staff_sessions;
CREATE TRIGGER staff_sessions_deny_if_deletion_open
  BEFORE INSERT ON staff_sessions
  FOR EACH ROW
  EXECUTE FUNCTION staff_sessions_deny_if_deletion_open();

ALTER FUNCTION staff_sessions_deny_if_deletion_open() OWNER TO migration_owner;

-- Apply path: reuse shared revoke helper (idempotent; keeps SEC-1 apply guarantee).
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

  -- Staff Gate sessions (SEC-1): ACK may have revoked already; keep idempotent.
  PERFORM public.revoke_sessions_for_user(v_user_id);

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
  -- Explicit (R5): REJECTED elsewhere must not reactivate sessions revoked here.

  RETURN QUERY SELECT p_request_id, v_user_id, true;
END;
$$;

REVOKE ALL ON FUNCTION apply_account_anonymization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_account_anonymization(uuid) TO ticket_runtime;
ALTER FUNCTION apply_account_anonymization(uuid) OWNER TO migration_owner;
