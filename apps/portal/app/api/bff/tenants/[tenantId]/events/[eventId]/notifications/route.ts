import {
  isEventParams,
  pickSearchParams,
  requireEventParams,
} from '../../../../../../../../src/bff/event-params';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import { forwardStaffBearer } from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

/** Notification list — ACCEPTED ≠ DELIVERED (UI labels). */
export async function GET(request: Request, { params }: Props) {
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;
  const qs = pickSearchParams(new URL(request.url), [
    'cursor',
    'limit',
    'state',
    'channel',
  ]);
  return forwardStaffBearer(
    `${PORTAL_UPSTREAM.notifications(scope.tenantId, scope.eventId)}${qs}`,
    { method: 'GET' },
  );
}
