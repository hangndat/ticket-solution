import { INVITATION_CLAIM_COMMAND } from '@ticket/contracts';
import { invitationClaimUpstreamPath } from '../../../../src/guest/claim-api';
import { isScope, scopeError } from '../../../../src/bff/event-scope';
import { isUuid } from '../../../../src/bff/ids';
import { assertSameOrigin } from '../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../src/bff/upstream';

type Body = {
  tenantId?: string;
  eventId?: string;
  token?: string;
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, string | boolean>;
  termsAccepted?: boolean;
  idempotencyKey?: string;
};

/**
 * POST guest invitation claim — verified OIDC actor + one-time token.
 * Never log token; never accept email from client as proof.
 */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const scope = scopeError(body);
  if (!isScope(scope)) return scope;
  const token = body.token?.trim() ?? '';
  if (!token || token.length > 2048) {
    return bffApiError(
      'INVITATION_TOKEN_INVALID',
      'token is required.',
      422,
    );
  }
  const idempotencyKey = body.idempotencyKey?.trim() ?? '';
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  if (body.termsAccepted !== true) {
    return bffApiError(
      'TERMS_REQUIRED',
      'termsAccepted must be true.',
      422,
    );
  }
  const formVersion = body.formVersion?.trim() ?? '';
  const termsVersion = body.termsVersion?.trim() ?? '';
  if (!formVersion || !termsVersion) {
    return bffApiError(
      'FORM_VERSION_REQUIRED',
      'formVersion and termsVersion from published schema are required.',
      422,
    );
  }

  const payload: Record<string, unknown> = {
    command: INVITATION_CLAIM_COMMAND,
    token,
    formVersion,
    termsVersion,
    termsAccepted: true as const,
  };
  if (body.answers && typeof body.answers === 'object') {
    payload.answers = body.answers;
  }

  return forwardWithBearer(invitationClaimUpstreamPath(scope), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
