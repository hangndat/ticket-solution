import { assertMutatingBrowserAsync } from '../../../../../src/bff/csrf';
import { bffApiError, isUuid } from '../../../../../src/bff/upstream';
import { PLATFORM_PATHS } from '../../../../../src/platform/contracts';
import { forwardTenantBearer } from '../../../../../src/platform/forward';

type Body = { confirmation?: boolean; idempotencyKey?: string };

/** POST account deletion ACK — never claims COMPLETED / erased. */
export async function POST(request: Request) {
  const csrf = await assertMutatingBrowserAsync(request);
  if (csrf) return csrf;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  if (body.confirmation !== true) {
    return bffApiError(
      'INVALID_INPUT',
      'confirmation:true is required.',
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
  return forwardTenantBearer(PLATFORM_PATHS.accountDeletion, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ confirmation: true }),
  });
}

export async function GET() {
  return forwardTenantBearer(PLATFORM_PATHS.accountDeletionCurrent, {
    method: 'GET',
  });
}
