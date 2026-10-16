-- Run as the migration owner, never the application login.
-- Provision ticket_runtime as NOLOGIN NOSUPERUSER NOBYPASSRLS separately.
CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL
);
CREATE TABLE events (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  CONSTRAINT events_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT events_tenant_slug_key UNIQUE (tenant_id, slug),
  CONSTRAINT events_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenants TO ticket_runtime
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY event_isolation ON events TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
REVOKE ALL ON tenants, events FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ticket_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, events TO ticket_runtime;
