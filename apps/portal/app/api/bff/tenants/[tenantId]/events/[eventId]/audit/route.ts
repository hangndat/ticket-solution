import {
  isEventParams,
  pickSearchParams,
  requireEventParams,
} from '../../../../../../../../src/bff/event-params';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import { forwardStaffBearer } from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

/** H-A1 — event audit browser (staff report.read; no platform cookie). */
export async function GET(request: Request, { params }: Props) {
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;
  const qs = pickSearchParams(new URL(request.url), [
    'cursor',
    'limit',
    'from',
    'to',
    'action',
  ]);
  return forwardStaffBearer(
    `${PORTAL_UPSTREAM.audit(scope.tenantId, scope.eventId)}${qs}`,
    { method: 'GET' },
  );
}
