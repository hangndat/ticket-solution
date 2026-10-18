-- H-P2 / ADR-20: sanitized platform tenant health counters.
-- Platform runtime must not SELECT notifications/outbox rows (PII/payloads);
-- aggregate through SECURITY DEFINER like platform_tenant_usage_counts.
-- notifications is FORCE RLS: migration_owner policy required for definer reads.
-- outbox is ENABLE-only (no FORCE); owner policy kept for consistency.

CREATE POLICY notifications_owner ON notifications TO migration_owner
  USING (true) WITH CHECK (true);

CREATE POLICY outbox_owner ON outbox TO migration_owner
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION platform_tenant_health_counts(p_tenant_id uuid)
RETURNS TABLE (
  notifications_pending integer,
  notifications_failed integer,
  notifications_dead integer,
  outbox_pending integer,
  outbox_failed integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    (
      SELECT COUNT(*)::int FROM notifications
      WHERE tenant_id = p_tenant_id AND state = 'PENDING'
    ),
    (
      SELECT COUNT(*)::int FROM notifications
      WHERE tenant_id = p_tenant_id AND state = 'FAILED'
    ),
    (
      SELECT COUNT(*)::int FROM notifications
      WHERE tenant_id = p_tenant_id AND state = 'DEAD'
    ),
    (
      SELECT COUNT(*)::int FROM outbox
      WHERE tenant_id = p_tenant_id
        AND status IN ('PENDING', 'LEASED')
    ),
    (
      SELECT COUNT(*)::int FROM outbox
      WHERE tenant_id = p_tenant_id AND status = 'DEAD'
    );
$$;

ALTER FUNCTION platform_tenant_health_counts(uuid) OWNER TO migration_owner;
REVOKE ALL ON FUNCTION platform_tenant_health_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_tenant_health_counts(uuid) TO ticket_platform_runtime;
