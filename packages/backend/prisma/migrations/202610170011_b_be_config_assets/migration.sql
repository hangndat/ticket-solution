-- B-BE: event assets (quarantine → READY) + published brand snapshot.
-- Config versions remain append-only; brand snapshot freezes tenant inheritance at publish.

ALTER TABLE events
  ADD COLUMN published_brand_snapshot jsonb;

CREATE TABLE event_assets (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
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
  CONSTRAINT event_assets_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT event_assets_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT event_assets_author_fk FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT event_assets_status_chk CHECK (
    status IN ('QUARANTINE', 'READY', 'REJECTED')
  ),
  CONSTRAINT event_assets_ready_chk CHECK (
    (status = 'READY' AND ready_key IS NOT NULL AND content_type IS NOT NULL
      AND byte_length IS NOT NULL AND width_px IS NOT NULL AND height_px IS NOT NULL
      AND finalized_at IS NOT NULL)
    OR (status <> 'READY')
  ),
  CONSTRAINT event_assets_quarantine_key_uq UNIQUE (quarantine_key)
);

CREATE INDEX event_assets_event_idx
  ON event_assets (tenant_id, event_id, status);

ALTER TABLE event_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_assets FORCE ROW LEVEL SECURITY;

CREATE POLICY event_assets_isolation ON event_assets TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON event_assets TO ticket_runtime;
