-- O31: gate (cổng) entity per event. staff_sessions.gate_id is NULLABLE so
-- existing sessions and clients that open without a gate are unaffected.

CREATE TABLE gates (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gates_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT gates_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT gates_event_name_key UNIQUE (tenant_id, event_id, name),
  CONSTRAINT gates_event_id_key UNIQUE (tenant_id, event_id, id),
  CONSTRAINT gates_name_chk CHECK (char_length(btrim(name)) BETWEEN 1 AND 80)
);

ALTER TABLE gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gates FORCE ROW LEVEL SECURITY;

CREATE POLICY gates_isolation ON gates TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON gates TO ticket_runtime;

-- Composite FK pins the gate to the same tenant AND the same event as the session.
ALTER TABLE staff_sessions ADD COLUMN gate_id uuid;
ALTER TABLE staff_sessions
  ADD CONSTRAINT staff_sessions_gate_fk FOREIGN KEY (tenant_id, event_id, gate_id)
    REFERENCES gates(tenant_id, event_id, id) ON DELETE RESTRICT;
