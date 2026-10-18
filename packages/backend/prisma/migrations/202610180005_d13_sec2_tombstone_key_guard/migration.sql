-- D13 / SEC-2 B1: expose unexpired tombstone key_ids for fail-closed denylist.
-- API cannot SELECT across actor RLS; DEFINER returns only key ids (no digests/subjects).

CREATE OR REPLACE FUNCTION account_deletion_unexpired_tombstone_key_ids()
RETURNS TABLE (out_key_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT r.subject_tombstone_key_id
  FROM public.account_deletion_requests r
  WHERE r.subject_tombstone_digest IS NOT NULL
    AND r.subject_tombstone_key_id IS NOT NULL
    AND r.subject_tombstone_expires_at IS NOT NULL
    AND r.subject_tombstone_expires_at >= clock_timestamp();
END;
$$;

REVOKE ALL ON FUNCTION account_deletion_unexpired_tombstone_key_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION account_deletion_unexpired_tombstone_key_ids() TO ticket_runtime;
ALTER FUNCTION account_deletion_unexpired_tombstone_key_ids() OWNER TO migration_owner;
