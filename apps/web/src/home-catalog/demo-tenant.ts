import { isExplicitDemoLabel } from '../published/format';

export function isDemoCatalogTenant(
  tenantSlug: string,
  organizationName: string,
): boolean {
  const slug = tenantSlug.trim().toLowerCase();
  if (slug.includes('demo')) return true;
  return isExplicitDemoLabel(organizationName);
}
