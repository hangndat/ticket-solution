import {
  isEventParams,
  pickSearchParams,
  requireEventParams,
} from '../../../../../../../../src/bff/event-params';
import { withPrivateNoStore } from '../../../../../../../../src/bff/cache-control';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import { forwardStaffBearer } from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

/** H-C1 — codes browse (inventory.import; q hashed server-side). */
export async function GET(request: Request, { params }: Props) {
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;
  const qs = pickSearchParams(new URL(request.url), [
    'cursor',
    'limit',
    'state',
    'sourceId',
    'ticketTypeId',
    'q',
  ]);
  const res = await forwardStaffBearer(
    `${PORTAL_UPSTREAM.codes(scope.tenantId, scope.eventId)}${qs}`,
    { method: 'GET' },
  );
  return withPrivateNoStore(res);
}
