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

  let body: { idempotencyKey?: string; format?: string; filter?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const idempotencyKey = typeof body?.idempotencyKey === 'string'
    ? body.idempotencyKey.trim() : '';
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
  if (body.filter !== undefined) {
    const raw = body.filter;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return bffApiError('INVALID_FILTER', 'Invalid export filter.', 422);
    }
    const filter = raw as Record<string, unknown>;
    if (Object.keys(filter).some((key) => !['states', 'from', 'to'].includes(key))) {
      return bffApiError('INVALID_FILTER', 'Invalid export filter.', 422);
    }
    const states = filter.states;
    if (states !== undefined && (!Array.isArray(states) || states.length > 4 ||
      states.some((state) => !['ACTIVE', 'REVOKED', 'CANCELLED', 'USED'].includes(state)))) {
      return bffApiError('INVALID_FILTER', 'Invalid ticket states.', 422);
    }
    const dates = [filter.from, filter.to];
    if (dates.some((date) => date !== undefined &&
      (typeof date !== 'string' || !Number.isFinite(Date.parse(date))))) {
      return bffApiError('INVALID_FILTER', 'Invalid export date range.', 422);
    }
    if (typeof filter.from === 'string' && typeof filter.to === 'string' &&
      Date.parse(filter.from) > Date.parse(filter.to)) {
      return bffApiError('INVALID_FILTER', 'Export date range is reversed.', 422);
    }
    payload.filter = {
      ...(states !== undefined ? { states } : {}),
      ...(filter.from !== undefined ? { from: filter.from } : {}),
      ...(filter.to !== undefined ? { to: filter.to } : {}),
    };
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
