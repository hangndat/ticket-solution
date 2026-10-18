/**
 * Authz codes that must clear staff chrome immediately (SEC-CACHE / O02 §5–6).
 * Does not invent eligibility — only decides when to fail-closed SiteNav.
 */
export function isMembershipAuthzDenial(
  status: number,
  body: unknown,
): boolean {
  if (status === 401) return true;
  if (status !== 403) return false;
  if (!body || typeof body !== 'object') return false;
  const code = (body as Record<string, unknown>).code;
  if (typeof code !== 'string') return false;
  return code.startsWith('MEMBERSHIP_') || code === 'PERMISSION_DENIED';
}
