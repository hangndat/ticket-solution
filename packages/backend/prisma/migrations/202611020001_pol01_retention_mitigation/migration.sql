-- F04 / POL-01 (#1034): retention mitigation — SEC-D-01 fix + device hard-delete.
-- Forward migration only; does NOT alter historical migrations, public state enum,
-- or retention figures (30 / 365 / 730 / 90 days).
--
-- 1) apply_account_anonymization: hard-DELETE every device registration for the
--    user at PG scrub, including already-revoked rows. Raw APNs tokens are
--    reachable PII with no reconciliation purpose; keep no raw token or token hash.
-- 2) purge_expired_account_deletion_tombstones: only purge the digest of a
--    terminal (COMPLETED + DELETED/NOT_FOUND) request. A REQUESTED request whose
--    tentative expiry lapsed during provider fault must keep its digest so the
--    post-terminal denylist window (idp_deleted_at + 48h) stays effective.
--
-- Both functions keep the SECURITY DEFINER / migration_owner owner / ticket_runtime
-- EXECUTE grant / idempotency patterns already established in D13 SEC-2.

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
  v_pg_applied timestamptz;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid request id';
  END IF;

  SELECT r.user_id, r.state, r.policy_version, r.pg_applied_at
    INTO v_user_id, v_state, v_policy, v_pg_applied
  FROM public.account_deletion_requests r
  WHERE r.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_request_id, NULL::uuid, false;
    RETURN;
  END IF;

  IF v_state = 'COMPLETED' OR v_pg_applied IS NOT NULL THEN
    RETURN QUERY SELECT p_request_id, v_user_id, false;
    RETURN;
  END IF;

  IF v_state <> 'REQUESTED' OR v_policy IS NULL THEN
    RAISE EXCEPTION 'account deletion not eligible for anonymize';
  END IF;

  -- Snapshot must be present before scrub (minted by worker; originals scrubbed at IdP COMPLETED).
  IF NOT EXISTS (
    SELECT 1 FROM public.account_deletion_requests r
    WHERE r.id = p_request_id
      AND r.original_issuer IS NOT NULL
      AND r.original_subject IS NOT NULL
      AND r.subject_tombstone_digest IS NOT NULL
      AND r.subject_tombstone_key_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'account deletion snapshot/tombstone required before PG apply';
  END IF;

  UPDATE public.users u
  SET email = NULL,
      email_verified = false,
      subject = 'anon:' || p_request_id::text,
      updated_at = clock_timestamp()
  WHERE u.id = v_user_id;

  -- POL-01: hard-delete every device registration for the user (incl. revoked).
  DELETE FROM public.device_tokens d
  WHERE d.user_id = v_user_id;

  UPDATE public.staff_sessions s
  SET status = 'REVOKED',
      revoked_at = clock_timestamp()
  WHERE s.user_id = v_user_id
    AND s.status = 'ACTIVE';

  UPDATE public.event_attendees ea
  SET canonical_email = NULL,
      updated_at = clock_timestamp()
  WHERE ea.user_id = v_user_id
    AND ea.canonical_email IS NOT NULL;

  UPDATE public.account_deletion_requests r
  SET pg_applied_at = clock_timestamp(),
      idp_status = COALESCE(r.idp_status, 'PENDING'),
      updated_at = clock_timestamp()
  WHERE r.id = p_request_id;

  -- Explicit: do NOT set state=COMPLETED here (needs IdP DELETE/NOT_FOUND).
  -- Explicit non-goals: do not DELETE audit rows; do not erase IdP here.

  RETURN QUERY SELECT p_request_id, v_user_id, true;
END;
$$;

REVOKE ALL ON FUNCTION apply_account_anonymization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_account_anonymization(uuid) TO ticket_runtime;
ALTER FUNCTION apply_account_anonymization(uuid) OWNER TO migration_owner;

-- Hourly purge of expired tombstone digests (retain row; clear digest fields).
-- Only terminal requests: a REQUESTED row with a lapsed tentative expiry must
-- keep its digest until finalize re-anchors expires_at = idp_deleted_at + 48h.
CREATE OR REPLACE FUNCTION purge_expired_account_deletion_tombstones()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.account_deletion_requests r
  SET subject_tombstone_digest = NULL,
      subject_tombstone_key_id = NULL,
      subject_tombstone_expires_at = NULL,
      updated_at = clock_timestamp()
  WHERE r.subject_tombstone_digest IS NOT NULL
    AND r.subject_tombstone_expires_at IS NOT NULL
    AND r.subject_tombstone_expires_at < clock_timestamp()
    AND r.state = 'COMPLETED'
    AND r.idp_status IN ('DELETED', 'NOT_FOUND');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION purge_expired_account_deletion_tombstones() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_account_deletion_tombstones() TO ticket_runtime;
ALTER FUNCTION purge_expired_account_deletion_tombstones() OWNER TO migration_owner;
