-- GATE-03 signed QR / manual credential (PRD M08)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS manual_entry_code_hash text NULL,
  ADD COLUMN IF NOT EXISTS manual_entry_code_sealed text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_manual_code_hmac_unique
  ON tickets (tenant_id, event_id, manual_entry_code_hash)
  WHERE manual_entry_code_hash IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_manual_code_pair_chk'
  ) THEN
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_manual_code_pair_chk CHECK (
        (manual_entry_code_hash IS NULL) = (manual_entry_code_sealed IS NULL)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ticket_credentials_one_active_idx
  ON ticket_credentials (tenant_id, ticket_id)
  WHERE status = 'ACTIVE';

ALTER TABLE checkin_reservations
  ADD COLUMN IF NOT EXISTS presented_via text NOT NULL DEFAULT 'qr',
  ADD COLUMN IF NOT EXISTS presented_credential_version integer NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'checkin_reservations_presented_via_chk'
  ) THEN
    ALTER TABLE checkin_reservations
      ADD CONSTRAINT checkin_reservations_presented_via_chk
      CHECK (presented_via IN ('qr', 'manual'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS gate_manual_code_backfill_runs (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  cursor_ticket_id uuid NULL,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'UNFINISHED', 'COMPLETED')),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE gate_manual_code_backfill_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_manual_code_backfill_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gate_manual_code_backfill_runs_isolation
  ON gate_manual_code_backfill_runs;
CREATE POLICY gate_manual_code_backfill_runs_isolation
  ON gate_manual_code_backfill_runs
  TO ticket_runtime
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE ON gate_manual_code_backfill_runs TO ticket_runtime;
