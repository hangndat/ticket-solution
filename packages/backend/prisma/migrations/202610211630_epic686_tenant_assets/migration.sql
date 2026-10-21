-- Epic #686 — tenant-scoped branding assets (org logo without event anchor).

CREATE TABLE tenant_assets (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  status text NOT NULL,
  content_type text,
  byte_length integer,
  width_px integer,
  height_px integer,
  quarantine_key text NOT NULL,
  ready_key text,
  original_filename text NOT NULL,
  sha256 text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  reject_reason text,
  CONSTRAINT tenant_assets_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT tenant_assets_tenant_fk FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT tenant_assets_author_fk FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT tenant_assets_status_chk CHECK (
    status IN ('QUARANTINE', 'READY', 'REJECTED')
  ),
  CONSTRAINT tenant_assets_ready_chk CHECK (
    (status = 'READY' AND ready_key IS NOT NULL AND content_type IS NOT NULL
      AND byte_length IS NOT NULL AND width_px IS NOT NULL AND height_px IS NOT NULL
      AND finalized_at IS NOT NULL)
    OR (status <> 'READY')
  ),
  CONSTRAINT tenant_assets_quarantine_key_uq UNIQUE (quarantine_key)
);

CREATE INDEX tenant_assets_tenant_status_idx
  ON tenant_assets (tenant_id, status);

ALTER TABLE tenant_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_assets FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_assets_isolation ON tenant_assets TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON tenant_assets TO ticket_runtime;
