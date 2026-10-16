export type AdminAction = 'save' | 'publish' | 'import' | 'quota';

export type AdminDecision =
  | { kind: 'saved'; version: number }
  | { kind: 'published'; version: number }
  | { kind: 'imported'; count: number }
  | { kind: 'quota'; capacity: number; allocated: number }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export const ADMIN_UNKNOWN =
  'Kết quả chưa biết. Không coi là đã lưu, đã publish, hoặc đã nhập mã.';

function record(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

export function decideAdmin(
  action: AdminAction,
  status: number,
  json: unknown,
  networkError: boolean,
): AdminDecision {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: ADMIN_UNKNOWN };
  }
  const body = record(json);
  if (action === 'save' && (status === 200 || status === 201) && typeof body?.version === 'number') {
    return { kind: 'saved', version: body.version };
  }
  if (
    action === 'publish' &&
    (status === 200 || status === 201) &&
    body?.status === 'PUBLISHED' &&
    typeof body.publishedConfigVersion === 'number'
  ) {
    return { kind: 'published', version: body.publishedConfigVersion };
  }
  if (
    action === 'import' &&
    (status === 200 || status === 201) &&
    typeof body?.imported === 'number'
  ) {
    return { kind: 'imported', count: body.imported };
  }
  if (
    action === 'quota' &&
    status === 200 &&
    typeof body?.capacity === 'number' &&
    typeof body.allocated === 'number'
  ) {
    return { kind: 'quota', capacity: body.capacity, allocated: body.allocated };
  }
  if (typeof body?.code === 'string') {
    return {
      kind: 'rejected',
      code: body.code,
      message: typeof body.message === 'string' ? body.message : body.code,
    };
  }
  return { kind: 'unknown', message: ADMIN_UNKNOWN };
}
