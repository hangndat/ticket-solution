-- O06: worker needs only the global overdue count, not cross-actor row access.
CREATE FUNCTION count_overdue_account_deletion_requests()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT count(*)::integer
  FROM public.account_deletion_requests
  WHERE state = 'REQUESTED'
    AND policy_version IS NOT NULL
    AND requested_at < clock_timestamp() - interval '30 days'
$$;

REVOKE ALL ON FUNCTION count_overdue_account_deletion_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION count_overdue_account_deletion_requests() TO ticket_runtime;
ALTER FUNCTION count_overdue_account_deletion_requests() OWNER TO migration_owner;
