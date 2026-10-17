-- D7 offline Gate sync: idempotency ledger + check-in provenance (Issues #106/#107).
-- RLS + tenant isolation unchanged; runtime role still cannot bypass.

ALTER TABLE checkins
  ADD COLUMN source text NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN device_id uuid,
  ADD COLUMN client_event_id uuid;

ALTER TABLE checkins
  ADD CONSTRAINT checkins_source_chk CHECK (source IN ('ONLINE', 'OFFLINE'));

CREATE UNIQUE INDEX checkins_client_event_unique
  ON checkins (tenant_id, client_event_id)
  WHERE client_event_id IS NOT NULL;

CREATE TABLE offline_sync_events (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  client_event_id uuid NOT NULL,
  device_id uuid NOT NULL,
  staff_session_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  client_occurred_at timestamptz NOT NULL,
  client_seq integer NOT NULL,
  payload_hash text NOT NULL,
  checkin_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT offline_sync_events_pkey PRIMARY KEY (tenant_id, client_event_id),
  CONSTRAINT offline_sync_events_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT offline_sync_events_ticket_fk FOREIGN KEY (tenant_id, ticket_id)
    REFERENCES tickets(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT offline_sync_events_session_fk FOREIGN KEY (tenant_id, staff_session_id)
    REFERENCES staff_sessions(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT offline_sync_events_checkin_fk FOREIGN KEY (tenant_id, checkin_id)
    REFERENCES checkins(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT offline_sync_events_actor_fk FOREIGN KEY (actor_user_id)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT offline_sync_events_seq_chk CHECK (client_seq >= 0)
);

CREATE INDEX offline_sync_events_device_session_seq
  ON offline_sync_events (
    tenant_id, event_id, device_id, staff_session_id, client_seq
  );

ALTER TABLE offline_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_sync_events FORCE ROW LEVEL SECURITY;

CREATE POLICY offline_sync_events_isolation ON offline_sync_events TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON offline_sync_events TO ticket_runtime;
