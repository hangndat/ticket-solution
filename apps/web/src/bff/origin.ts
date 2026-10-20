import { checkRequestOrigin } from '@ticket/web-session';
import { bffApiError } from './api-error';

/**
 * Thin adapter over @ticket/web-session — no forked CSRF logic.
 */
export function assertSameOrigin(request: Request): Response | null {
  const violation = checkRequestOrigin({
    method: request.method,
    url: request.url,
    headers: request.headers,
  });
  if (!violation) return null;
  const messages: Record<string, string> = {
    CSRF_ORIGIN_REQUIRED: 'Mutating BFF calls require a matching Origin.',
    CSRF_ORIGIN_MISMATCH: 'Origin does not match this host.',
    ORIGIN_NOT_CONFIGURED: 'WEB_PUBLIC_ORIGIN is missing or invalid.',
    INVALID_REQUEST_URL: 'Request URL is invalid.',
  };
  return bffApiError(
    violation.code,
    messages[violation.code] ?? 'Origin check failed.',
    violation.status,
  );
}
