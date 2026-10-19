-- P2-ROLES-PRESET: named server role presets + invite role = enum ∪ preset id.
-- Client never sends free-form permission arrays on invite/accept (ADR §7).

CREATE TABLE role_presets (
  id uuid NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  name text NOT NULL,
  schema_version integer NOT NULL,
  tenant_permissions text[] NOT NULL DEFAULT '{}',
  event_permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT role_presets_pkey PRIMARY KEY (id),
  CONSTRAINT role_presets_name_len_chk CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT role_presets_schema_version_chk CHECK (schema_version >= 1)
);

CREATE UNIQUE INDEX role_presets_tenant_name_unique
  ON role_presets (tenant_id, lower(name))
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX role_presets_global_name_unique
  ON role_presets (lower(name))
  WHERE tenant_id IS NULL;

ALTER TABLE role_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_presets FORCE ROW LEVEL SECURITY;

-- Tenant-scoped rows isolated; platform-global templates (tenant_id NULL) readable.
CREATE POLICY role_presets_isolation ON role_presets TO ticket_runtime
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

-- SECURITY DEFINER accept_membership_invite resolves preset permissions.
CREATE POLICY role_presets_owner ON role_presets TO migration_owner
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON role_presets FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_presets TO ticket_runtime;

-- Allow invite.role to store built-in enum or preset UUID.
ALTER TABLE membership_invites DROP CONSTRAINT membership_invites_role_chk;
ALTER TABLE membership_invites ADD CONSTRAINT membership_invites_role_chk CHECK (
  role IN ('Owner', 'Manager', 'CS', 'Supervisor', 'Scanner')
  OR role ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

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
  preset RECORD;
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

  IF inv.role IN ('Owner', 'Manager', 'CS', 'Supervisor', 'Scanner') THEN
    tperms := CASE inv.role
      WHEN 'Owner' THEN ARRAY['tenant.profile','members.manage','event.create','event.list']
      WHEN 'Manager' THEN ARRAY['event.create']
      ELSE ARRAY[]::text[]
    END;
  ELSE
    SELECT * INTO preset FROM role_presets
      WHERE id = inv.role::uuid
        AND (tenant_id IS NULL OR tenant_id = inv.tenant_id);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invite_invalid_or_expired';
    END IF;
    tperms := COALESCE(preset.tenant_permissions, ARRAY[]::text[]);
  END IF;

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
    IF erole IN ('Owner', 'Manager', 'CS', 'Supervisor', 'Scanner') THEN
      eperms := CASE erole
        WHEN 'Owner' THEN ARRAY['event.config','event.publish','inventory.import','redemption.approve','report.read','export.create','export.download','cs.lookup','cs.resend','gate.confirm','gate.undo','ticket.revoke']
        WHEN 'Manager' THEN ARRAY['event.config','event.publish','inventory.import','redemption.approve','report.read','export.create','export.download']
        WHEN 'CS' THEN ARRAY['cs.lookup','cs.resend']
        WHEN 'Supervisor' THEN ARRAY['gate.confirm','gate.undo','ticket.revoke']
        WHEN 'Scanner' THEN ARRAY['gate.confirm']
        ELSE ARRAY[]::text[]
      END;
    ELSIF erole ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT event_permissions INTO eperms FROM role_presets
        WHERE id = erole::uuid
          AND (tenant_id IS NULL OR tenant_id = inv.tenant_id);
      IF NOT FOUND THEN
        eperms := ARRAY[]::text[];
      END IF;
    ELSE
      eperms := ARRAY[]::text[];
    END IF;
    IF eid IS NOT NULL THEN
      INSERT INTO event_assignments (
        id, tenant_id, event_id, membership_id, permissions, activated_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), inv.tenant_id, eid, mid, COALESCE(eperms, ARRAY[]::text[]),
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
