import { bffApiError, forwardWithBearer, isUuid } from '../bff/upstream';
import { eventPath, isScope, scopeError, type AdminScope } from './scope';

export type ApprovalCommand = {
  scope: AdminScope;
  requestId: string;
  idempotencyKey: string;
  body: Record<string, unknown>;
};

export async function readApprovalCommand(
  request: Request,
): Promise<Response | ApprovalCommand> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const scope = scopeError({
    tenantId: typeof body.tenantId === 'string' ? body.tenantId : undefined,
    eventId: typeof body.eventId === 'string' ? body.eventId : undefined,
  });
  if (!isScope(scope)) return scope;
  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
  if (!isUuid(requestId)) {
    return bffApiError('REQUEST_ID_REQUIRED', 'requestId must be a UUID.', 422);
  }
  const provided =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  return {
    scope,
    requestId,
    idempotencyKey: provided || crypto.randomUUID(),
    body,
  };
}

export function isApprovalCommand(
  value: Response | ApprovalCommand,
): value is ApprovalCommand {
  return !(value instanceof Response);
}

export function forwardApproval(
  command: ApprovalCommand,
  action: 'approve' | 'deny',
  payload?: { reason: string },
): Promise<Response> {
  const headers: Record<string, string> = {
    'idempotency-key': command.idempotencyKey,
  };
  if (payload) headers['Content-Type'] = 'application/json';
  return forwardWithBearer(
    eventPath(
      command.scope,
      `redemptions/${encodeURIComponent(command.requestId)}/${action}`,
    ),
    {
      method: 'POST',
      headers,
      ...(payload ? { body: JSON.stringify({ reason: payload.reason }) } : {}),
    },
  );
}

export function denialReason(body: Record<string, unknown>): Response | string {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    return bffApiError('REASON_REQUIRED', 'Denial reason is required.', 422);
  }
  if (reason.length > 500) {
    return bffApiError(
      'REASON_TOO_LONG',
      'Denial reason must be at most 500 characters.',
      422,
    );
  }
  return reason;
}
