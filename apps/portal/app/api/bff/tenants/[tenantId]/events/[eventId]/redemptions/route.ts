import {
  isEventParams,
  pickSearchParams,
  requireEventParams,
} from '../../../../../../../../src/bff/event-params';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import { forwardStaffBearer } from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

/**
 * G-R2 — GET pending redemptions (wire BFF list; approve/deny are sibling routes).
 */
export async function GET(request: Request, { params }: Props) {
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;
  const qs = pickSearchParams(new URL(request.url), [
    'cursor',
    'limit',
    'status',
    'sourceId',
    'ticketTypeId',
    'q',
  ]);
  return forwardStaffBearer(
    `${PORTAL_UPSTREAM.redemptions(scope.tenantId, scope.eventId)}${qs}`,
    { method: 'GET' },
  );
}
