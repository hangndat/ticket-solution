/** Tenant org home — explicit event clear and tenant switch land here. */
export function isTenantOrgHomePath(pathname: string): boolean {
  return /^\/t\/[^/]+\/?$/.test(pathname);
}

/** Event segment from URL; rejects Ant clear artifacts and non-routes. */
export function parsePathEventId(pathname: string): string | null {
  const m = pathname.match(/^\/t\/[^/]+\/e\/([^/]+)/);
  const id = m?.[1];
  if (!id || id === 'undefined' || id === 'null') return null;
  return id;
}

/**
 * Navigation target after event Select change (including allowClear → undefined).
 * Single route decision — do not also push from onClear.
 */
export function routeAfterEventSelectChange(
  tenantId: string,
  value: string | null | undefined,
): string | null {
  if (!tenantId) return null;
  if (value == null || value === '') {
    return `/t/${tenantId}`;
  }
  return `/t/${tenantId}/e/${value}`;
}

/**
 * Event context for shell strip + menus: explicit /e/ wins; org home never resurrects cache.
 */
export function resolveShellEffectiveEventId(
  pathname: string,
  cachedEventId: string | null,
): string | null {
  const pathEventId = parsePathEventId(pathname);
  if (pathEventId) return pathEventId;
  if (isTenantOrgHomePath(pathname)) return null;
  return cachedEventId;
}
