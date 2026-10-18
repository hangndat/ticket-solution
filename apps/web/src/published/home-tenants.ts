/**
 * Home catalog tenant entry points (ADR-19 / O12-d).
 * Only slugs — never hardcode event content. Defaults match D9 demo seed.
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

const DEFAULT_HOME_TENANT_SLUGS = ['demo-fun', 'demo-studio'] as const;

/**
 * Parse PUBLIC_HOME_TENANT_SLUGS (comma-separated).
 * Empty / unset → D9 seed tenants. Invalid tokens dropped.
 */
export function homeTenantSlugs(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): readonly string[] {
  const raw = env.PUBLIC_HOME_TENANT_SLUGS?.trim();
  if (!raw) return [...DEFAULT_HOME_TENANT_SLUGS];
  const parsed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => SLUG_RE.test(s));
  return parsed.length > 0 ? parsed : [...DEFAULT_HOME_TENANT_SLUGS];
}
