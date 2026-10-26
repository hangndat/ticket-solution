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

/** GET guest invitations (masked). */
export async function GET(request: Request, { params }: Props) {
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;
  const qs = pickSearchParams(new URL(request.url), [
    'cursor',
    'limit',
    'state',
    'q',
  ]);
  return forwardStaffBearer(
    `${PORTAL_UPSTREAM.invitations(scope.tenantId, scope.eventId)}${qs}`,
    { method: 'GET' },
  );
}

type DispatchBody = {
  invitationIds?: unknown;
  previewRevision?: number;
  idempotencyKey?: string;
};

/** POST dispatch selected invitations (after dispatch-preview). */
export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;

  let body: DispatchBody;
  try {
    body = (await request.json()) as DispatchBody;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const idempotencyKey = body.idempotencyKey?.trim() ?? '';
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
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
  if (
    !Number.isInteger(body.previewRevision) ||
    (body.previewRevision as number) < 1
  ) {
    return bffApiError(
      'PREVIEW_REVISION_REQUIRED',
      'previewRevision must be a positive integer.',
      422,
    );
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.invitationDispatch(scope.tenantId, scope.eventId),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        invitationIds: (body.invitationIds as string[]).map((id) => id.trim()),
        previewRevision: body.previewRevision,
      }),
    },
  );
}
