/** Portal org/event selection cache — IDs only, no tokens or business payloads. */

export const PORTAL_CONTEXT_CACHE_VERSION = 1 as const;

export type PortalContextCache = {
  version: typeof PORTAL_CONTEXT_CACHE_VERSION;
  /** Last staff org the user chose (UUID). */
  tenantId: string | null;
  /**
   * Last event per tenant. Absent key = never chosen for that tenant.
   * `null` = user explicitly cleared event for that tenant.
   */
  eventByTenant: Record<string, string | null>;
  /** ACTIVE tenants the user has opened under `/t/*` (skip first-run on home). */
  portalUsedTenants: string[];
};

export type ValidatedPortalContext = {
  tenantId: string;
  eventId: string | null;
};
