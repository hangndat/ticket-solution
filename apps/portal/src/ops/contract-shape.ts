/** Shared fail-closed shape helpers aligned with BE PR54 OpenAPI / contracts. */

export function asRecord(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

export function apiErrorFrom(
  body: Record<string, unknown> | null,
): { code: string; message: string } | null {
  if (!body || typeof body.code !== 'string' || !body.code.trim()) return null;
  return {
    code: body.code,
    message: typeof body.message === 'string' ? body.message : body.code,
  };
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function isExportStatus(
  value: unknown,
): value is 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' {
  return (
    value === 'PENDING' ||
    value === 'PROCESSING' ||
    value === 'READY' ||
    value === 'FAILED'
  );
}

export function isProviderStatus(
  value: unknown,
): value is 'PENDING' | 'ACCEPTED' | 'FAILED' | 'DEAD' | 'UNKNOWN' {
  return (
    value === 'PENDING' ||
    value === 'ACCEPTED' ||
    value === 'FAILED' ||
    value === 'DEAD' ||
    value === 'UNKNOWN'
  );
}
