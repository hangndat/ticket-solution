import { assertMutatingBrowser } from '../../../../../../../../../src/bff/csrf';
import {
  isEventParams,
  requireEventParams,
} from '../../../../../../../../../src/bff/event-params';
import { isUuid } from '../../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

/** Quota estimate only — does not reserve or send mail. */
export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;

  let body: { invitationIds?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  if (
    !Array.isArray(body.invitationIds) ||
    body.invitationIds.length === 0 ||
    !body.invitationIds.every(
      (id) => typeof id === 'string' && isUuid(id.trim()),
    )
  ) {
    return bffApiError(
      'INVITATION_IDS_REQUIRED',
      'invitationIds must be a non-empty UUID array.',
      422,
    );
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.invitationDispatchPreview(scope.tenantId, scope.eventId),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invitationIds: (body.invitationIds as string[]).map((id) => id.trim()),
      }),
    },
  );
}
