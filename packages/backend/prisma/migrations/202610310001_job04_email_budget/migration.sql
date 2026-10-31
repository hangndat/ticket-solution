ALTER TABLE tenant_email_usage
  ADD COLUMN held_count integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT tenant_email_usage_counts_nonnegative
    CHECK (sent_count >= 0 AND held_count >= 0);

CREATE TABLE tenant_email_budget_attempts (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  attempt_id uuid NOT NULL,
  outbox_id uuid NOT NULL,
  lease_token text NOT NULL,
  usage_date date NOT NULL,
  state text NOT NULL CHECK (state IN ('HELD', 'ACCEPTED', 'UNKNOWN', 'RELEASED')),
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, attempt_id),
  UNIQUE (tenant_id, outbox_id, lease_token),
  FOREIGN KEY (tenant_id, usage_date)
    REFERENCES tenant_email_usage(tenant_id, usage_date) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, outbox_id)
    REFERENCES outbox(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX tenant_email_budget_attempts_reconcile
  ON tenant_email_budget_attempts (tenant_id, usage_date, state);

ALTER TABLE tenant_email_budget_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_email_budget_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_email_budget_attempts_tenant ON tenant_email_budget_attempts
  TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY tenant_email_budget_attempts_owner ON tenant_email_budget_attempts
  TO migration_owner USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tenant_email_budget_attempts TO ticket_runtime;
