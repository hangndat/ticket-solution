-- F05: production tables are owned by ticket_owner, while O06 cross-tenant
-- functions execute as migration_owner under FORCE RLS. Policies alone do not
-- confer table privileges. Grant only columns used by those definer paths.
GRANT SELECT (
  tenant_id, id, ends_at, cancelled_at, business_status,
  ticket_pii_anonymized_at, export_retention_fenced_at,
  export_retention_barrier_generation, export_retention_inventory_evidence,
  export_retention_inventory_recorded_at
) ON public.events TO migration_owner;
GRANT UPDATE (
  ticket_pii_anonymized_at, export_retention_fenced_at,
  export_retention_barrier_generation, export_retention_inventory_evidence,
  export_retention_inventory_recorded_at
) ON public.events TO migration_owner;

GRANT SELECT (tenant_id, event_id, canonical_email)
  ON public.event_attendees TO migration_owner;
GRANT UPDATE (canonical_email, updated_at)
  ON public.event_attendees TO migration_owner;

-- redemption_requests and exports already have production SELECT grants;
-- exports also already has UPDATE. The PII sweep only writes these columns.
GRANT UPDATE (answers_json, updated_at)
  ON public.redemption_requests TO migration_owner;
