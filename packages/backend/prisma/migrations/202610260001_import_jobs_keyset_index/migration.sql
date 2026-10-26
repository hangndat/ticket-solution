-- Build without blocking import job writes. The final id key matches the
-- deterministic tie-break in ORDER BY created_at DESC, id DESC.
CREATE INDEX CONCURRENTLY import_jobs_event_created_id_idx
  ON import_jobs (tenant_id, event_id, created_at DESC, id DESC);
