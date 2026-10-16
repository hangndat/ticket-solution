-- Tenant staff membership + event assignment (deny-by-default).
-- Active = activated_at IS NOT NULL AND revoked_at IS NULL.
-- Privileged ops take FOR SHARE on the membership row; revoke takes FOR UPDATE (§5.2).
CREATE TABLE memberships (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  activated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_pkey PRIMARY KEY (id),
  CONSTRAINT memberships_tenant_id_key UNIQUE (tenant_id, id),
  CONSTRAINT memberships_tenant_user_key UNIQUE (tenant_id, user_id),
  CONSTRAINT memberships_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT memberships_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT memberships_active_window_chk CHECK (
    revoked_at IS NULL OR activated_at IS NOT NULL
  )
);

CREATE TABLE event_assignments (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  activated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT event_assignments_tenant_id_key UNIQUE (tenant_id, id),
  CONSTRAINT event_assignments_membership_event_key UNIQUE (tenant_id, event_id, membership_id),
  CONSTRAINT event_assignments_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT event_assignments_membership_fk FOREIGN KEY (tenant_id, membership_id)
    REFERENCES memberships(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT event_assignments_active_window_chk CHECK (
    revoked_at IS NULL OR activated_at IS NOT NULL
  )
);

CREATE INDEX memberships_user_id_idx ON memberships (user_id);
CREATE INDEX event_assignments_membership_id_idx ON event_assignments (membership_id);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE event_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY membership_isolation ON memberships TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY event_assignment_isolation ON event_assignments TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON memberships, event_assignments FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON memberships, event_assignments TO ticket_runtime;
