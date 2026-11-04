-- Runtime can invoke only the wrapper, which uses the database clock.
-- The private predicate allows deterministic boundary tests by the DB owner.
CREATE FUNCTION account_deletion_overdue_count_at(p_as_of timestamptz)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT count(*)::integer
  FROM public.account_deletion_requests
  WHERE state = 'REQUESTED'
    AND policy_version IS NOT NULL
    AND requested_at <= p_as_of - interval '30 days'
$$;
REVOKE ALL ON FUNCTION account_deletion_overdue_count_at(timestamptz) FROM PUBLIC;
ALTER FUNCTION account_deletion_overdue_count_at(timestamptz) OWNER TO migration_owner;

CREATE OR REPLACE FUNCTION count_overdue_account_deletion_requests()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.account_deletion_overdue_count_at(clock_timestamp())
$$;
REVOKE ALL ON FUNCTION count_overdue_account_deletion_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION count_overdue_account_deletion_requests() TO ticket_runtime;
ALTER FUNCTION count_overdue_account_deletion_requests() OWNER TO migration_owner;
