import { assertMutatingBrowser } from '../../../../../../../../src/bff/csrf';
import {
  isEventParams,
  pickSearchParams,
  requireEventParams,
} from '../../../../../../../../src/bff/event-params';
import { isUuid } from '../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

/** Export history list (G-E1 filters when provided). */
export async function GET(request: Request, { params }: Props) {
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;
  const qs = pickSearchParams(new URL(request.url), [
    'cursor',
    'limit',
    'status',
  ]);
  return forwardStaffBearer(
    `${PORTAL_UPSTREAM.exports(scope.tenantId, scope.eventId)}${qs}`,
    { method: 'GET' },
  );
}

/** Create CSV export job. */
export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;

  let body: { idempotencyKey?: string; format?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const idempotencyKey = body.idempotencyKey?.trim() || crypto.randomUUID();
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  const payload: Record<string, unknown> = {};
  if (typeof body.format === 'string' && body.format.trim()) {
    payload.format = body.format.trim();
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.exports(scope.tenantId, scope.eventId),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    },
  );
}
