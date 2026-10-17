import type { ApiError } from '@ticket/contracts';

/** JSON error Response for BFF route handlers — no Next.js server APIs. */
export function bffApiError(
  code: string,
  message: string,
  status: number,
  retryable = false,
): Response {
  const body: ApiError = {
    code,
    message,
    requestId: crypto.randomUUID(),
    retryable,
  };
  return Response.json(body, { status });
}
