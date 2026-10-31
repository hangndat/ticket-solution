-- DB-09 reissue: guarantee at most one ACTIVE ticket_credentials row per
-- ticket at any time, even if application code has a bug that skips the
-- invalidate-old-before-insert-new step. CONCURRENTLY so it does not block
-- issuance writes on ticket_credentials in a populated environment.
CREATE UNIQUE INDEX CONCURRENTLY ticket_credentials_one_active_idx
  ON ticket_credentials (tenant_id, ticket_id)
  WHERE status = 'ACTIVE';
