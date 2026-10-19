-- P2-ONBOARD-PENDING: self-serve tenant registration → status PENDING (Operator ACTIVE).
-- Does not change Operator provision_tenant / accept_membership_invite auto-ACTIVE path.

CREATE TABLE tenant_registrations (
  id uuid PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES users (id),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  client_key text NOT NULL,
  request_hash text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tenant_registrations_idem UNIQUE (actor_user_id, client_key),
  CONSTRAINT tenant_registrations_client_key_len CHECK (
    char_length(client_key) >= 8 AND char_length(client_key) <= 128
  )
);

CREATE INDEX tenant_registrations_actor_created_idx
  ON tenant_registrations (actor_user_id, created_at DESC);

ALTER TABLE tenant_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_registrations FORCE ROW LEVEL SECURITY;

-- No direct runtime DML — access only via SECURITY DEFINER below.
CREATE POLICY tenant_registrations_owner ON tenant_registrations
  TO migration_owner USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE tenant_registrations FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE tenant_registrations TO migration_owner;

-- Self-serve: create PENDING tenant + active Owner membership (no invite token / secrets).
-- Rate limit + idempotency enforced inside; ACTIVE only via Operator setTenantStatus.
CREATE OR REPLACE FUNCTION register_pending_tenant(
  p_registration_id uuid,
  p_tenant_id uuid,
  p_slug text,
  p_name text,
  p_timezone text,
  p_contact text,
  p_actor_user_id uuid,
  p_client_key text,
  p_request_hash text,
  p_max_events integer,
  p_max_staff integer,
  p_email_per_day integer,
  p_import_rows integer,
  p_imports_enabled boolean,
  p_exports_enabled boolean,
  p_rate_window_seconds integer,
  p_rate_max integer,
  p_max_pending_owned integer
)
RETURNS TABLE (
  out_registration_id uuid,
  out_tenant_id uuid,
  out_status text,
  out_replay boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  existing RECORD;
  pending_count integer;
  recent_count integer;
  owner_perms text[];
BEGIN
  IF p_actor_user_id IS NULL OR p_registration_id IS NULL OR p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF p_client_key IS NULL
     OR char_length(p_client_key) < 8
     OR char_length(p_client_key) > 128 THEN
    RAISE EXCEPTION 'idempotency_key_required';
  END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$' THEN
    RAISE EXCEPTION 'invalid_slug';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(p_name) > 200 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF p_timezone IS NULL OR char_length(btrim(p_timezone)) < 1 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF p_rate_window_seconds IS NULL OR p_rate_window_seconds < 60
     OR p_rate_max IS NULL OR p_rate_max < 1
     OR p_max_pending_owned IS NULL OR p_max_pending_owned < 1 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  -- Idempotency (actor-scoped)
  SELECT id, tenant_id, request_hash
    INTO existing
  FROM tenant_registrations
  WHERE actor_user_id = p_actor_user_id
    AND client_key = p_client_key
  FOR UPDATE;

  IF FOUND THEN
    IF existing.request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    RETURN QUERY
      SELECT existing.id, existing.tenant_id, t.status::text, true
      FROM tenants t
      WHERE t.id = existing.tenant_id;
    RETURN;
  END IF;

  -- Abuse: recent registrations
  SELECT COUNT(*)::integer INTO recent_count
  FROM tenant_registrations
  WHERE actor_user_id = p_actor_user_id
    AND created_at > clock_timestamp() - make_interval(secs => p_rate_window_seconds);
  IF recent_count >= p_rate_max THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  -- Abuse: too many PENDING orgs already owned
  SELECT COUNT(*)::integer INTO pending_count
  FROM memberships m
  JOIN tenants t ON t.id = m.tenant_id
  WHERE m.user_id = p_actor_user_id
    AND m.role = 'Owner'
    AND m.revoked_at IS NULL
    AND m.activated_at IS NOT NULL
    AND t.status = 'PENDING';
  IF pending_count >= p_max_pending_owned THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  owner_perms := ARRAY[
    'tenant.profile',
    'members.manage',
    'event.create',
    'event.list'
  ];

  BEGIN
    INSERT INTO tenants (id, slug, name, status, contact, default_timezone, version)
    VALUES (
      p_tenant_id,
      p_slug,
      btrim(p_name),
      'PENDING',
      NULLIF(btrim(COALESCE(p_contact, '')), ''),
      btrim(p_timezone),
      1
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'slug_taken';
  END;

  INSERT INTO tenant_limits (
    tenant_id, max_events, max_staff, email_per_day, import_rows_per_job,
    imports_enabled, exports_enabled
  ) VALUES (
    p_tenant_id, p_max_events, p_max_staff, p_email_per_day, p_import_rows,
    p_imports_enabled, p_exports_enabled
  );

  -- Active Owner membership while tenant stays PENDING (Operator activates tenant).
  INSERT INTO memberships (
    id, tenant_id, user_id, role, permissions, activated_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    p_tenant_id,
    p_actor_user_id,
    'Owner',
    owner_perms,
    clock_timestamp(),
    clock_timestamp(),
    clock_timestamp()
  );

  INSERT INTO tenant_registrations (
    id, actor_user_id, tenant_id, client_key, request_hash, slug, created_at
  ) VALUES (
    p_registration_id,
    p_actor_user_id,
    p_tenant_id,
    p_client_key,
    p_request_hash,
    p_slug,
    clock_timestamp()
  );

  INSERT INTO platform_audit_logs (
    id, actor_user_id, action, resource_type, resource_id, tenant_id, sanitized_diff
  ) VALUES (
    gen_random_uuid(),
    p_actor_user_id,
    'public.tenant.registration',
    'tenant',
    p_tenant_id,
    p_tenant_id,
    jsonb_build_object(
      'slug', p_slug,
      'status', 'PENDING',
      'registrationId', p_registration_id
    )
  );

  RETURN QUERY SELECT p_registration_id, p_tenant_id, 'PENDING'::text, false;
END;
$$;

REVOKE ALL ON FUNCTION register_pending_tenant(
  uuid, uuid, text, text, text, text, uuid, text, text,
  integer, integer, integer, integer, boolean, boolean,
  integer, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_pending_tenant(
  uuid, uuid, text, text, text, text, uuid, text, text,
  integer, integer, integer, integer, boolean, boolean,
  integer, integer, integer
) TO ticket_runtime;
ALTER FUNCTION register_pending_tenant(
  uuid, uuid, text, text, text, text, uuid, text, text,
  integer, integer, integer, integer, boolean, boolean,
  integer, integer, integer
) OWNER TO migration_owner;
