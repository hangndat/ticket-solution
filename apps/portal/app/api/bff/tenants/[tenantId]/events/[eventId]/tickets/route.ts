import {
  isEventParams,
  pickSearchParams,
  requireEventParams,
} from '../../../../../../../../src/bff/event-params';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import { forwardStaffBearer } from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

/** CS ticket list — exact opaque query only when provided. */
export async function GET(request: Request, { params }: Props) {
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;
  const qs = pickSearchParams(new URL(request.url), ['q', 'limit', 'cursor']);
  return forwardStaffBearer(
    `${PORTAL_UPSTREAM.tickets(scope.tenantId, scope.eventId)}${qs}`,
    { method: 'GET' },
  );
}
