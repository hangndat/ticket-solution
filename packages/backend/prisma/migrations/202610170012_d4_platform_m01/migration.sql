-- Platform M01/M02/M12: tenants status/limits, operators, invites, support, deletion.
-- ticket_platform_runtime: NOBYPASSRLS, non-owner, metadata only (no tickets/PII).

-- 1) Expand tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS contact text,
  ADD COLUMN IF NOT EXISTS default_timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN IF NOT EXISTS logo_asset_id uuid,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_chk;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_status_chk CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED'));
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_name_len_chk;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_name_len_chk CHECK (char_length(name) BETWEEN 1 AND 200);
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_slug_fmt_chk;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_slug_fmt_chk CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$');

-- Existing fixtures stay ACTIVE; new production tenants created PENDING via provision.

CREATE TABLE tenant_limits (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
  max_events integer,
  max_staff integer,
  email_per_day integer,
  import_rows_per_job integer,
  imports_enabled boolean NOT NULL DEFAULT true,
  exports_enabled boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_limits_nonneg_chk CHECK (
    (max_events IS NULL OR max_events >= 0)
    AND (max_staff IS NULL OR max_staff >= 0)
    AND (email_per_day IS NULL OR email_per_day >= 0)
    AND (import_rows_per_job IS NULL OR import_rows_per_job >= 0)
  )
);

INSERT INTO tenant_limits (tenant_id)
SELECT id FROM tenants
ON CONFLICT DO NOTHING;

CREATE TABLE platform_operators (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  activated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_bootstrap_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  bootstrapped_at timestamptz NOT NULL,
  operator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE platform_audit_logs (
  id uuid PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  sanitized_diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_operations (
  id uuid PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  command text NOT NULL,
  client_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL,
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_operations_idem UNIQUE (actor_user_id, command, client_key)
);

CREATE TABLE tenant_admin_operations (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  id uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  command text NOT NULL,
  client_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL,
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_admin_operations_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT tenant_admin_operations_idem UNIQUE (tenant_id, actor_user_id, command, client_key)
);

CREATE TABLE membership_invites (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role_schema_version integer NOT NULL DEFAULT 1,
  assignment_intentions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_invites_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT membership_invites_token_unique UNIQUE (token_hash),
  CONSTRAINT membership_invites_role_chk CHECK (
    role IN ('Owner', 'Manager', 'CS', 'Supervisor', 'Scanner')
  )
);

CREATE UNIQUE INDEX membership_invites_pending_email_unique
  ON membership_invites (tenant_id, email)
  WHERE revoked_at IS NULL AND accepted_at IS NULL;

CREATE TABLE support_grants (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  operator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL,
  scopes text[] NOT NULL,
  reason text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_grants_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT support_grants_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT support_grants_reason_len_chk CHECK (char_length(reason) BETWEEN 1 AND 500),
  CONSTRAINT support_grants_expiry_chk CHECK (expires_at > created_at)
);

CREATE TABLE account_deletion_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  state text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  policy_version text,
  handled_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  sanitized_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_deletion_state_chk CHECK (
    state IN ('REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY', 'COMPLETED', 'REJECTED')
  )
);

CREATE UNIQUE INDEX account_deletion_one_open
  ON account_deletion_requests (user_id)
  WHERE state IN ('REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY');

CREATE TABLE tenant_email_usage (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  usage_date date NOT NULL,
  sent_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, usage_date)
);

-- Platform runtime role must be provisioned separately (like ticket_runtime):
--   CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
-- Test harnesses and deploy create it before migrate; migration_owner has no CREATEROLE.

ALTER TABLE tenant_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_limits FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_operators FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_bootstrap_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_bootstrap_state FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_operations FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_admin_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admin_operations FORCE ROW LEVEL SECURITY;
ALTER TABLE membership_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_invites FORCE ROW LEVEL SECURITY;
ALTER TABLE support_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_email_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_email_usage FORCE ROW LEVEL SECURITY;

-- Tenant status/limits mutations are enforced in app (tenant-policy) + ticket_platform_runtime.
-- Keep ticket_runtime INSERT for fixture/bootstrap paths; DELETE remains allowed for cleanup tests.
REVOKE DELETE ON tenants FROM ticket_runtime;

CREATE POLICY tenant_limits_tenant ON tenant_limits TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_limits_platform ON tenant_limits TO ticket_platform_runtime
  USING (true) WITH CHECK (true);

CREATE POLICY tenants_platform_meta ON tenants TO ticket_platform_runtime
  USING (true) WITH CHECK (true);

CREATE POLICY platform_operators_self ON platform_operators TO ticket_platform_runtime
  USING (true) WITH CHECK (true);

CREATE POLICY platform_bootstrap_platform ON platform_bootstrap_state TO ticket_platform_runtime
  USING (true) WITH CHECK (true);

CREATE POLICY platform_audit_platform ON platform_audit_logs TO ticket_platform_runtime
  USING (true) WITH CHECK (true);

CREATE POLICY platform_ops_platform ON platform_operations TO ticket_platform_runtime
  USING (true) WITH CHECK (true);

CREATE POLICY tenant_admin_ops_isolation ON tenant_admin_operations TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY membership_invites_tenant ON membership_invites TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY membership_invites_platform ON membership_invites TO ticket_platform_runtime
  USING (true) WITH CHECK (true);

CREATE POLICY support_grants_platform ON support_grants TO ticket_platform_runtime
  USING (true) WITH CHECK (true);

CREATE POLICY support_grants_tenant ON support_grants TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY account_deletion_actor ON account_deletion_requests TO ticket_runtime
  USING (user_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.actor_id', true), '')::uuid);

CREATE POLICY tenant_email_usage_tenant ON tenant_email_usage TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_email_usage_platform ON tenant_email_usage TO ticket_platform_runtime
  USING (true) WITH CHECK (true);

-- Owner policies for SECURITY DEFINER (FORCE RLS)
CREATE POLICY tenant_limits_owner ON tenant_limits TO migration_owner USING (true) WITH CHECK (true);
CREATE POLICY membership_invites_owner ON membership_invites TO migration_owner USING (true) WITH CHECK (true);
CREATE POLICY platform_ops_owner ON platform_operators TO migration_owner USING (true) WITH CHECK (true);
CREATE POLICY platform_bootstrap_owner ON platform_bootstrap_state TO migration_owner USING (true) WITH CHECK (true);
CREATE POLICY platform_audit_owner ON platform_audit_logs TO migration_owner USING (true) WITH CHECK (true);
CREATE POLICY tenants_owner_meta ON tenants TO migration_owner USING (true) WITH CHECK (true);
CREATE POLICY memberships_owner ON memberships TO migration_owner USING (true) WITH CHECK (true);
CREATE POLICY support_grants_owner ON support_grants TO migration_owner USING (true) WITH CHECK (true);
CREATE POLICY events_owner ON events TO migration_owner USING (true) WITH CHECK (true);
CREATE POLICY tickets_owner_definer ON tickets TO migration_owner USING (true) WITH CHECK (true);
CREATE POLICY users_owner_definer ON users TO migration_owner USING (true) WITH CHECK (true);
CREATE POLICY account_deletion_owner ON account_deletion_requests TO migration_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON tenant_limits TO ticket_runtime;
GRANT SELECT, INSERT, UPDATE ON tenant_limits TO ticket_platform_runtime;
GRANT SELECT, INSERT, UPDATE ON tenants TO ticket_platform_runtime;
GRANT SELECT, INSERT, UPDATE ON platform_operators TO ticket_platform_runtime;
GRANT SELECT, INSERT ON platform_bootstrap_state TO ticket_platform_runtime;
GRANT INSERT ON platform_audit_logs TO ticket_platform_runtime;
GRANT SELECT, INSERT, UPDATE ON platform_operations TO ticket_platform_runtime;
GRANT SELECT, INSERT, UPDATE ON membership_invites TO ticket_runtime;
GRANT SELECT, INSERT, UPDATE ON membership_invites TO ticket_platform_runtime;
GRANT SELECT, INSERT, UPDATE ON support_grants TO ticket_platform_runtime;
GRANT SELECT ON support_grants TO ticket_runtime;
GRANT SELECT, INSERT, UPDATE ON tenant_admin_operations TO ticket_runtime;
GRANT SELECT, INSERT, UPDATE ON account_deletion_requests TO ticket_runtime;
GRANT SELECT, INSERT, UPDATE ON tenant_email_usage TO ticket_runtime;
GRANT SELECT, INSERT, UPDATE ON tenant_email_usage TO ticket_platform_runtime;
-- Platform must not receive tickets/users PII grants (intentionally omitted).

-- Self tenant discovery (narrow; actor from GUC set by verified identity)
CREATE OR REPLACE FUNCTION list_my_tenants()
RETURNS TABLE (
  tenant_id uuid,
  slug text,
  name text,
  status text,
  role text,
  permissions text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor uuid;
BEGIN
  actor := NULLIF(current_setting('app.actor_id', true), '')::uuid;
  IF actor IS NULL THEN
    RAISE EXCEPTION 'actor required';
  END IF;
  RETURN QUERY
  SELECT t.id, t.slug, t.name, t.status, m.role, m.permissions
  FROM memberships m
  JOIN tenants t ON t.id = m.tenant_id
  WHERE m.user_id = actor
    AND m.revoked_at IS NULL
    AND m.activated_at IS NOT NULL
    AND m.activated_at <= clock_timestamp();
END;
$$;
REVOKE ALL ON FUNCTION list_my_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_my_tenants() TO ticket_runtime;

-- Provision tenant + owner invite (platform only)
CREATE OR REPLACE FUNCTION provision_tenant(
  p_tenant_id uuid,
  p_slug text,
  p_name text,
  p_timezone text,
  p_contact text,
  p_owner_email text,
  p_invite_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_actor_user_id uuid,
  p_max_events integer,
  p_max_staff integer,
  p_email_per_day integer,
  p_import_rows integer,
  p_imports_enabled boolean,
  p_exports_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$' THEN
    RAISE EXCEPTION 'invalid slug';
  END IF;
  INSERT INTO tenants (id, slug, name, status, contact, default_timezone, version)
  VALUES (p_tenant_id, p_slug, p_name, 'PENDING', p_contact, p_timezone, 1);
  INSERT INTO tenant_limits (
    tenant_id, max_events, max_staff, email_per_day, import_rows_per_job,
    imports_enabled, exports_enabled
  ) VALUES (
    p_tenant_id, p_max_events, p_max_staff, p_email_per_day, p_import_rows,
    p_imports_enabled, p_exports_enabled
  );
  INSERT INTO membership_invites (
    tenant_id, id, email, role, token_hash, expires_at, created_by, role_schema_version
  ) VALUES (
    p_tenant_id, p_invite_id, lower(p_owner_email), 'Owner', p_token_hash,
    p_expires_at, p_actor_user_id, 1
  );
END;
$$;
REVOKE ALL ON FUNCTION provision_tenant(
  uuid, text, text, text, text, text, uuid, text, timestamptz, uuid,
  integer, integer, integer, integer, boolean, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provision_tenant(
  uuid, text, text, text, text, text, uuid, text, timestamptz, uuid,
  integer, integer, integer, integer, boolean, boolean
) TO ticket_platform_runtime;

-- Accept invite by token hash (self command before membership; no cross-tenant SELECT for runtime).
CREATE OR REPLACE FUNCTION accept_membership_invite(
  p_token_hash text,
  p_user_id uuid,
  p_email text
)
RETURNS TABLE (
  out_tenant_id uuid,
  out_membership_id uuid,
  out_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  inv RECORD;
  mid uuid;
  item jsonb;
  eid uuid;
  erole text;
  eperms text[];
  tperms text[];
BEGIN
  IF p_token_hash IS NULL OR p_user_id IS NULL OR p_email IS NULL THEN
    RAISE EXCEPTION 'invalid accept input';
  END IF;

  SELECT * INTO inv FROM membership_invites WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR inv.revoked_at IS NOT NULL OR inv.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'invite_invalid_or_expired';
  END IF;
  IF lower(inv.email) <> lower(p_email) THEN
    RAISE EXCEPTION 'invite_invalid_or_expired';
  END IF;
  IF inv.accepted_at IS NOT NULL THEN
    IF inv.accepted_by = p_user_id THEN
      SELECT m.id INTO mid FROM memberships m WHERE m.tenant_id = inv.tenant_id AND m.user_id = p_user_id;
      RETURN QUERY SELECT inv.tenant_id, mid, t.status FROM tenants t WHERE t.id = inv.tenant_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'invite_already_used';
  END IF;

  PERFORM 1 FROM tenants WHERE id = inv.tenant_id FOR UPDATE;

  tperms := CASE inv.role
    WHEN 'Owner' THEN ARRAY['tenant.profile','members.manage','event.create','event.list']
    WHEN 'Manager' THEN ARRAY['event.create']
    ELSE ARRAY[]::text[]
  END;

  INSERT INTO memberships (
    id, tenant_id, user_id, role, permissions, activated_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), inv.tenant_id, p_user_id, inv.role, tperms,
    clock_timestamp(), clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET role = EXCLUDED.role,
      permissions = EXCLUDED.permissions,
      activated_at = clock_timestamp(),
      revoked_at = NULL,
      updated_at = clock_timestamp();

  SELECT m.id INTO mid FROM memberships m WHERE m.tenant_id = inv.tenant_id AND m.user_id = p_user_id;

  UPDATE event_assignments
  SET revoked_at = clock_timestamp(), updated_at = clock_timestamp()
  WHERE tenant_id = inv.tenant_id AND membership_id = mid AND revoked_at IS NULL;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(inv.assignment_intentions, '[]'::jsonb))
  LOOP
    eid := NULLIF(item->>'eventId','')::uuid;
    erole := item->>'role';
    eperms := CASE erole
      WHEN 'Owner' THEN ARRAY['event.config','event.publish','inventory.import','redemption.approve','report.read','export.create','export.download','cs.lookup','cs.resend','gate.confirm','gate.undo','ticket.revoke']
      WHEN 'Manager' THEN ARRAY['event.config','event.publish','inventory.import','redemption.approve','report.read','export.create','export.download']
      WHEN 'CS' THEN ARRAY['cs.lookup','cs.resend']
      WHEN 'Supervisor' THEN ARRAY['gate.confirm','gate.undo','ticket.revoke']
      WHEN 'Scanner' THEN ARRAY['gate.confirm']
      ELSE ARRAY[]::text[]
    END;
    IF eid IS NOT NULL THEN
      INSERT INTO event_assignments (
        id, tenant_id, event_id, membership_id, permissions, activated_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), inv.tenant_id, eid, mid, eperms,
        clock_timestamp(), clock_timestamp(), clock_timestamp()
      );
    END IF;
  END LOOP;

  IF inv.role = 'Owner' THEN
    UPDATE tenants SET status = 'ACTIVE', updated_at = clock_timestamp()
    WHERE id = inv.tenant_id AND status = 'PENDING';
  END IF;

  UPDATE membership_invites
  SET accepted_at = clock_timestamp(), accepted_by = p_user_id, updated_at = clock_timestamp()
  WHERE tenant_id = inv.tenant_id AND id = inv.id;

  RETURN QUERY SELECT inv.tenant_id, mid, t.status FROM tenants t WHERE t.id = inv.tenant_id;
END;
$$;
REVOKE ALL ON FUNCTION accept_membership_invite(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_membership_invite(text, uuid, text) TO ticket_runtime;
GRANT INSERT, UPDATE, SELECT ON outbox TO ticket_platform_runtime;


CREATE OR REPLACE FUNCTION bootstrap_platform_operator(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM platform_bootstrap_state WHERE id = true) THEN
    RAISE EXCEPTION 'bootstrap_already_done';
  END IF;
  INSERT INTO platform_operators (user_id, activated_at, created_by, created_at)
  VALUES (p_user_id, clock_timestamp(), p_user_id, clock_timestamp());
  INSERT INTO platform_bootstrap_state (id, bootstrapped_at, operator_user_id)
  VALUES (true, clock_timestamp(), p_user_id);
  INSERT INTO platform_audit_logs (
    id, actor_user_id, action, resource_type, resource_id, sanitized_diff, created_at
  ) VALUES (
    gen_random_uuid(), p_user_id, 'platform.bootstrap', 'platform_operator', p_user_id,
    '{}'::jsonb, clock_timestamp()
  );
END;
$$;
REVOKE ALL ON FUNCTION bootstrap_platform_operator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bootstrap_platform_operator(uuid) TO ticket_runtime;
GRANT EXECUTE ON FUNCTION bootstrap_platform_operator(uuid) TO ticket_platform_runtime;

-- Aggregate counters only (no membership/user/ticket rows) for platform pool.
CREATE OR REPLACE FUNCTION platform_tenant_has_active_owner(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE tenant_id = p_tenant_id
      AND role = 'Owner'
      AND revoked_at IS NULL
      AND activated_at IS NOT NULL
      AND activated_at <= clock_timestamp()
  );
$$;
REVOKE ALL ON FUNCTION platform_tenant_has_active_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_tenant_has_active_owner(uuid) TO ticket_platform_runtime;

CREATE OR REPLACE FUNCTION platform_tenant_usage_counts(p_tenant_id uuid)
RETURNS TABLE (
  events integer,
  staff_active integer,
  staff_pending integer,
  email_today integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    (SELECT COUNT(*)::int FROM events WHERE tenant_id = p_tenant_id),
    (SELECT COUNT(*)::int FROM memberships
      WHERE tenant_id = p_tenant_id AND revoked_at IS NULL
        AND activated_at IS NOT NULL),
    (SELECT COUNT(*)::int FROM membership_invites
      WHERE tenant_id = p_tenant_id
        AND revoked_at IS NULL AND accepted_at IS NULL
        AND expires_at > clock_timestamp()),
    COALESCE((
      SELECT sent_count FROM tenant_email_usage
      WHERE tenant_id = p_tenant_id AND usage_date = (now() AT TIME ZONE 'UTC')::date
    ), 0)::int;
$$;
REVOKE ALL ON FUNCTION platform_tenant_usage_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_tenant_usage_counts(uuid) TO ticket_platform_runtime;

-- Masked support ticket projection: platform pool never SELECTs tickets/users directly.
CREATE OR REPLACE FUNCTION list_support_tickets_masked(
  p_grant_id uuid,
  p_operator_user_id uuid
)
RETURNS TABLE (
  ticket_id uuid,
  state text,
  owner_email_masked text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  g record;
BEGIN
  -- Caller must have already locked the grant row; re-check liveness here.
  SELECT sg.id, sg.tenant_id, sg.event_id, sg.expires_at, sg.revoked_at,
         sg.operator_user_id, sg.scopes
    INTO g
  FROM support_grants sg
  WHERE sg.id = p_grant_id;

  IF g IS NULL
     OR g.revoked_at IS NOT NULL
     OR g.operator_user_id <> p_operator_user_id
     OR g.expires_at <= clock_timestamp()
     OR NOT ('cs.read' = ANY (g.scopes))
  THEN
    RAISE EXCEPTION 'support_grant_not_live';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.state::text,
    CASE
      WHEN u.email IS NULL OR position('@' IN u.email) <= 1 THEN '***'
      ELSE left(split_part(u.email, '@', 1), 1) || '***@' || split_part(u.email, '@', 2)
    END
  FROM tickets t
  LEFT JOIN users u ON u.id = t.owner_user_id
  WHERE t.tenant_id = g.tenant_id
    AND t.event_id = g.event_id
  ORDER BY t.created_at DESC
  LIMIT 50;
END;
$$;
REVOKE ALL ON FUNCTION list_support_tickets_masked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_support_tickets_masked(uuid, uuid) TO ticket_platform_runtime;
