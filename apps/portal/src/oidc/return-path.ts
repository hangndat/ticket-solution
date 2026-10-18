import {
  PORTAL_RETURN_PREFIXES,
  sanitizePostLoginPath,
} from '@ticket/web-session';

/**
 * Portal route map uses /t/[tenantId] and /account/* (handoff §3.2).
 * Extends package prefixes without forking sanitize logic.
 */
export const PORTAL_APP_RETURN_PREFIXES = [
  ...PORTAL_RETURN_PREFIXES,
  '/t',
  '/account',
] as const;

export function sanitizePortalReturnPath(
  raw: string | null | undefined,
): string | null {
  return sanitizePostLoginPath(raw, PORTAL_APP_RETURN_PREFIXES);
}
