-- D13 / SEC-2: IdP erasure flags + lease + tombstone denylist (no public state enum change).
-- COMPLETED iff pg_applied_at IS NOT NULL AND idp_status IN ('DELETED','NOT_FOUND').
-- apply_account_anonymization becomes PG-scrub only (sets pg_applied_at; stays REQUESTED).

ALTER TABLE account_deletion_requests
  ADD COLUMN IF NOT EXISTS pg_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_issuer text,
  ADD COLUMN IF NOT EXISTS original_subject text,
  ADD COLUMN IF NOT EXISTS subject_tombstone_digest bytea,
  ADD COLUMN IF NOT EXISTS subject_tombstone_key_id text,
  ADD COLUMN IF NOT EXISTS subject_tombstone_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS idp_lease_owner text,
  ADD COLUMN IF NOT EXISTS idp_lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS idp_status text,
  ADD COLUMN IF NOT EXISTS idp_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idp_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS idp_last_error_code text,
  ADD COLUMN IF NOT EXISTS idp_deleted_at timestamptz;

ALTER TABLE account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_idp_status_chk;

ALTER TABLE account_deletion_requests
  ADD CONSTRAINT account_deletion_idp_status_chk CHECK (
    idp_status IS NULL OR idp_status IN (
      'PENDING',
      'DISABLED_PENDING_DELETE',
      'DELETED',
      'NOT_FOUND',
      'FAILED'
    )
  );

CREATE INDEX IF NOT EXISTS account_deletion_tombstone_digest_idx
  ON account_deletion_requests (subject_tombstone_digest)
  WHERE subject_tombstone_digest IS NOT NULL;

CREATE INDEX IF NOT EXISTS account_deletion_tombstone_expires_idx
  ON account_deletion_requests (subject_tombstone_expires_at)
  WHERE subject_tombstone_digest IS NOT NULL;

-- Due list: open REQUESTED needing PG and/or IdP work; respect backoff.
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
    AND (
      r.idp_status IS NULL
      OR r.idp_status IN ('PENDING', 'DISABLED_PENDING_DELETE', 'FAILED')
    )
    AND (
      r.idp_next_attempt_at IS NULL
      OR r.idp_next_attempt_at <= clock_timestamp()
    )
  ORDER BY r.requested_at ASC, r.id ASC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION list_due_account_anonymizations(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_due_account_anonymizations(integer) TO ticket_runtime;
ALTER FUNCTION list_due_account_anonymizations(integer) OWNER TO migration_owner;

-- Claim short IdP lease (30–60s reclaim). Returns true if this owner holds the lease.
CREATE OR REPLACE FUNCTION claim_account_deletion_idp_lease(
  p_request_id uuid,
  p_owner text,
  p_ttl_seconds integer DEFAULT 45
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_request_id IS NULL OR p_owner IS NULL OR length(p_owner) < 1 THEN
    RAISE EXCEPTION 'invalid lease claim';
  END IF;
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 5 OR p_ttl_seconds > 300 THEN
    RAISE EXCEPTION 'invalid lease ttl';
  END IF;

  UPDATE public.account_deletion_requests r
  SET idp_lease_owner = p_owner,
      idp_lease_expires_at = clock_timestamp() + make_interval(secs => p_ttl_seconds),
      updated_at = clock_timestamp()
  WHERE r.id = p_request_id
    AND r.state = 'REQUESTED'
    AND (
      r.idp_lease_owner IS NULL
      OR r.idp_lease_owner = p_owner
      OR r.idp_lease_expires_at IS NULL
      OR r.idp_lease_expires_at < clock_timestamp()
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION claim_account_deletion_idp_lease(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_account_deletion_idp_lease(uuid, text, integer) TO ticket_runtime;
ALTER FUNCTION claim_account_deletion_idp_lease(uuid, text, integer) OWNER TO migration_owner;

-- PG scrub only — does NOT set COMPLETED (SEC-2). Idempotent when pg_applied_at set.
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

  UPDATE public.device_tokens d
  SET revoked_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE d.user_id = v_user_id
    AND d.revoked_at IS NULL;

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

-- Terminal IdP success → COMPLETED (fenced: requires lease owner + pg_applied_at).
CREATE OR REPLACE FUNCTION finalize_account_deletion_idp(
  p_request_id uuid,
  p_owner text,
  p_idp_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated integer;
  v_deleted_at timestamptz := clock_timestamp();
BEGIN
  IF p_idp_status IS NULL OR p_idp_status NOT IN ('DELETED', 'NOT_FOUND') THEN
    RAISE EXCEPTION 'invalid idp terminal status';
  END IF;
  IF p_owner IS NULL OR length(p_owner) < 1 THEN
    RAISE EXCEPTION 'invalid lease owner';
  END IF;

  UPDATE public.account_deletion_requests r
  SET idp_status = p_idp_status,
      idp_deleted_at = v_deleted_at,
      subject_tombstone_expires_at = v_deleted_at + interval '48 hours',
      original_issuer = NULL,
      original_subject = NULL,
      idp_lease_owner = NULL,
      idp_lease_expires_at = NULL,
      idp_last_error_code = NULL,
      state = 'COMPLETED',
      updated_at = clock_timestamp()
  WHERE r.id = p_request_id
    AND r.state = 'REQUESTED'
    AND r.pg_applied_at IS NOT NULL
    AND r.idp_lease_owner = p_owner
    AND r.idp_lease_expires_at IS NOT NULL
    AND r.idp_lease_expires_at >= clock_timestamp();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION finalize_account_deletion_idp(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_account_deletion_idp(uuid, text, text) TO ticket_runtime;
ALTER FUNCTION finalize_account_deletion_idp(uuid, text, text) OWNER TO migration_owner;

-- Record non-terminal IdP outcome + backoff; never COMPLETED.
CREATE OR REPLACE FUNCTION mark_account_deletion_idp_attempt(
  p_request_id uuid,
  p_owner text,
  p_idp_status text,
  p_error_code text,
  p_backoff_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_idp_status IS NULL OR p_idp_status NOT IN (
    'PENDING', 'DISABLED_PENDING_DELETE', 'FAILED'
  ) THEN
    RAISE EXCEPTION 'invalid non-terminal idp status';
  END IF;

  UPDATE public.account_deletion_requests r
  SET idp_status = p_idp_status,
      idp_last_error_code = left(COALESCE(p_error_code, 'IDP_UNKNOWN'), 64),
      idp_attempts = r.idp_attempts + 1,
      idp_next_attempt_at = clock_timestamp()
        + make_interval(secs => GREATEST(1, LEAST(COALESCE(p_backoff_seconds, 30), 3600))),
      idp_lease_owner = NULL,
      idp_lease_expires_at = NULL,
      updated_at = clock_timestamp()
  WHERE r.id = p_request_id
    AND r.state = 'REQUESTED'
    AND (r.idp_lease_owner = p_owner OR r.idp_lease_owner IS NULL);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION mark_account_deletion_idp_attempt(uuid, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_account_deletion_idp_attempt(uuid, text, text, text, integer) TO ticket_runtime;
ALTER FUNCTION mark_account_deletion_idp_attempt(uuid, text, text, text, integer) OWNER TO migration_owner;

-- Hourly purge of expired tombstone digests (retain row; clear digest fields).
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
    AND r.subject_tombstone_expires_at < clock_timestamp();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION purge_expired_account_deletion_tombstones() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_account_deletion_tombstones() TO ticket_runtime;
ALTER FUNCTION purge_expired_account_deletion_tombstones() OWNER TO migration_owner;

-- Deny lookup helper: unexpired digest hit (for upsert/API).
CREATE OR REPLACE FUNCTION account_deletion_tombstone_blocks(
  p_issuer text,
  p_digest bytea
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_issuer IS NULL OR p_digest IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.account_deletion_requests r
    WHERE r.subject_tombstone_digest = p_digest
      AND r.subject_tombstone_expires_at IS NOT NULL
      AND r.subject_tombstone_expires_at >= clock_timestamp()
  );
END;
$$;

REVOKE ALL ON FUNCTION account_deletion_tombstone_blocks(text, bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION account_deletion_tombstone_blocks(text, bytea) TO ticket_runtime;
ALTER FUNCTION account_deletion_tombstone_blocks(text, bytea) OWNER TO migration_owner;

-- Open deletion for (issuer,sub) — bypass actor RLS for identity gate.
CREATE OR REPLACE FUNCTION account_deletion_open_for_identity(
  p_issuer text,
  p_subject text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_issuer IS NULL OR p_subject IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.account_deletion_requests r
    INNER JOIN public.users u ON u.id = r.user_id
    WHERE r.state IN ('REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY')
      AND (
        (u.issuer = p_issuer AND u.subject = p_subject)
        OR (r.original_issuer = p_issuer AND r.original_subject = p_subject)
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION account_deletion_open_for_identity(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION account_deletion_open_for_identity(text, text) TO ticket_runtime;
ALTER FUNCTION account_deletion_open_for_identity(text, text) OWNER TO migration_owner;

-- Worker snapshot + tombstone mint persistence (bypasses actor RLS).
CREATE OR REPLACE FUNCTION prepare_account_deletion_snapshot(
  p_request_id uuid,
  p_issuer text,
  p_subject text,
  p_digest bytea,
  p_key_id text,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_request_id IS NULL OR p_issuer IS NULL OR p_subject IS NULL
     OR p_digest IS NULL OR p_key_id IS NULL OR p_expires_at IS NULL THEN
    RAISE EXCEPTION 'invalid deletion snapshot';
  END IF;

  UPDATE public.account_deletion_requests r
  SET original_issuer = p_issuer,
      original_subject = p_subject,
      subject_tombstone_digest = p_digest,
      subject_tombstone_key_id = p_key_id,
      subject_tombstone_expires_at = p_expires_at,
      idp_status = COALESCE(r.idp_status, 'PENDING'),
      updated_at = clock_timestamp()
  WHERE r.id = p_request_id
    AND r.state = 'REQUESTED'
    AND r.pg_applied_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION prepare_account_deletion_snapshot(uuid, text, text, bytea, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prepare_account_deletion_snapshot(uuid, text, text, bytea, text, timestamptz) TO ticket_runtime;
ALTER FUNCTION prepare_account_deletion_snapshot(uuid, text, text, bytea, text, timestamptz) OWNER TO migration_owner;

-- Read request flags for worker (bypass actor RLS).
CREATE OR REPLACE FUNCTION get_account_deletion_idp_row(p_request_id uuid)
RETURNS TABLE (
  out_original_issuer text,
  out_original_subject text,
  out_pg_applied_at timestamptz,
  out_idp_attempts integer,
  out_state text,
  out_idp_status text,
  out_idp_last_error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.original_issuer, r.original_subject, r.pg_applied_at, r.idp_attempts,
         r.state, r.idp_status, r.idp_last_error_code
  FROM public.account_deletion_requests r
  WHERE r.id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION get_account_deletion_idp_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_account_deletion_idp_row(uuid) TO ticket_runtime;
ALTER FUNCTION get_account_deletion_idp_row(uuid) OWNER TO migration_owner;
