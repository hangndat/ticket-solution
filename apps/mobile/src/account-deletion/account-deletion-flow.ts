import type { SessionBoundary, SessionEpoch } from '../identity/session-boundary.ts';
import {
  getCurrentAccountDeletionRequest,
  postAccountDeletionRequest,
  type GetCurrentAccountDeletionResult,
  type PostAccountDeletionResult,
} from './account-deletion-api.ts';
import type { AccountDeletionRequest } from './types.ts';

export type AccountDeletionUiPhase =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'loading' }
  | {
      kind: 'acknowledged';
      request: AccountDeletionRequest;
      /** Truth label: recorded request, not erasure. */
      ackMeansDeleted: false;
    }
  | {
      kind: 'status';
      request: AccountDeletionRequest;
      ackMeansDeleted: false;
    }
  | {
      kind: 'error';
      message: string;
      retryable: boolean;
      /**
       * refresh = retry GET /current (never invent POST).
       * resubmit = retry POST after user already confirmed (same Idempotency-Key).
       */
      retryAction?: 'refresh' | 'resubmit';
      /** Reuse on timeout recovery — same Idempotency-Key. */
      idempotencyKey?: string;
    }
  | { kind: 'unavailable'; message: string };

/** In-memory pending key per verified user — cleared on account switch. */
const pendingKeys = new Map<string, string>();

export function peekPendingIdempotencyKey(userId: string): string | undefined {
  return pendingKeys.get(userId);
}

export function clearPendingIdempotencyKey(userId: string): void {
  pendingKeys.delete(userId);
}

export function clearAllPendingIdempotencyKeys(): void {
  pendingKeys.clear();
}

export function retainPendingIdempotencyKey(
  userId: string,
  key: string,
): void {
  pendingKeys.set(userId, key);
}

export function createIdempotencyKey(
  createId: () => string = () => crypto.randomUUID(),
): string {
  return createId();
}

export function resolveIdempotencyKeyForSubmit(
  userId: string,
  createId: () => string = () => crypto.randomUUID(),
): string {
  const existing = pendingKeys.get(userId);
  if (existing) return existing;
  const next = createIdempotencyKey(createId);
  pendingKeys.set(userId, next);
  return next;
}

export function mapPostResult(
  result: PostAccountDeletionResult,
  idempotencyKey: string,
): AccountDeletionUiPhase {
  if (result.status === 'ok') {
    return {
      kind: 'acknowledged',
      request: result.request,
      ackMeansDeleted: false,
    };
  }
  if (result.status === 'unreachable') {
    return {
      kind: 'error',
      message:
        'Không xác định được kết quả (timeout/mạng). Thử lại với cùng Idempotency-Key — không tạo yêu cầu trùng.',
      retryable: true,
      retryAction: 'resubmit',
      idempotencyKey,
    };
  }
  if (result.status === 'unauthorized') {
    return {
      kind: 'error',
      message: 'Phiên không hợp lệ (UNAUTHENTICATED). Đăng nhập lại.',
      retryable: false,
    };
  }
  if (result.status === 'confirmation-required') {
    return {
      kind: 'error',
      message: 'Máy chủ yêu cầu confirmation:true (CONFIRMATION_REQUIRED).',
      retryable: false,
    };
  }
  if (result.status === 'idempotency-key-required') {
    return {
      kind: 'error',
      message: 'Thiếu Idempotency-Key (IDEMPOTENCY_KEY_REQUIRED).',
      retryable: false,
    };
  }
  if (result.status === 'idempotency-conflict') {
    return {
      kind: 'error',
      message:
        'Idempotency-Key trùng nhưng payload khác (IDEMPOTENCY_CONFLICT).',
      retryable: false,
      idempotencyKey,
    };
  }
  return {
    kind: 'unavailable',
    message:
      'API account-deletion chưa sẵn sàng hoặc phản hồi không hợp lệ. Fail-closed — không giả COMPLETED/đã xóa.',
  };
}

export function mapGetResult(
  result: GetCurrentAccountDeletionResult,
): AccountDeletionUiPhase {
  if (result.status === 'ok') {
    if (!result.request) return { kind: 'idle' };
    return {
      kind: 'status',
      request: result.request,
      ackMeansDeleted: false,
    };
  }
  if (result.status === 'unreachable') {
    return {
      kind: 'error',
      message: 'Không tải được trạng thái yêu cầu (mạng/timeout).',
      retryable: true,
      retryAction: 'refresh',
    };
  }
  if (result.status === 'unauthorized') {
    return {
      kind: 'error',
      message: 'Phiên không hợp lệ khi đọc yêu cầu xóa.',
      retryable: false,
    };
  }
  return {
    kind: 'unavailable',
    message:
      'GET account-deletion không khả dụng. Fail-closed — UI không bịa trạng thái đã xóa.',
  };
}

export async function submitAccountDeletionRequest(input: {
  session: SessionBoundary;
  epoch: SessionEpoch;
  userId: string;
  /** When retrying after timeout, pass the same key. */
  idempotencyKey?: string;
  fetchImpl?: typeof fetch;
  createId?: () => string;
}): Promise<AccountDeletionUiPhase> {
  const key =
    input.idempotencyKey ??
    resolveIdempotencyKeyForSubmit(input.userId, input.createId);
  retainPendingIdempotencyKey(input.userId, key);

  if (!input.session.isEpochCurrent(input.epoch)) {
    return { kind: 'idle' };
  }
  const bearer = await input.session.getCredential();
  if (!input.session.isEpochCurrent(input.epoch) || !bearer) {
    return { kind: 'idle' };
  }

  const controller = input.session.beginRequest();
  try {
    const result = await postAccountDeletionRequest(
      bearer,
      key,
      controller.signal,
      input.fetchImpl,
    );
    if (!input.session.isEpochCurrent(input.epoch)) {
      return { kind: 'idle' };
    }
    const phase = mapPostResult(result, key);
    if (phase.kind === 'acknowledged') {
      clearPendingIdempotencyKey(input.userId);
    }
    return phase;
  } finally {
    input.session.endRequest(controller);
  }
}

export async function loadCurrentAccountDeletionRequest(input: {
  session: SessionBoundary;
  epoch: SessionEpoch;
  fetchImpl?: typeof fetch;
}): Promise<AccountDeletionUiPhase> {
  if (!input.session.isEpochCurrent(input.epoch)) {
    return { kind: 'idle' };
  }
  const bearer = await input.session.getCredential();
  if (!input.session.isEpochCurrent(input.epoch) || !bearer) {
    return { kind: 'idle' };
  }
  const controller = input.session.beginRequest();
  try {
    const result = await getCurrentAccountDeletionRequest(
      bearer,
      controller.signal,
      input.fetchImpl,
    );
    if (!input.session.isEpochCurrent(input.epoch)) {
      return { kind: 'idle' };
    }
    return mapGetResult(result);
  } finally {
    input.session.endRequest(controller);
  }
}

/**
 * Retry an error phase without bypassing confirmation.
 * GET/load failures → refresh GET only.
 * Confirmed POST timeout → resubmit with the same Idempotency-Key.
 */
export function resolveAccountDeletionRetryAction(
  phase: AccountDeletionUiPhase,
): 'refresh' | 'resubmit' | null {
  if (phase.kind !== 'error' || !phase.retryable) return null;
  if (phase.retryAction === 'resubmit' && phase.idempotencyKey) {
    return 'resubmit';
  }
  if (phase.retryAction === 'refresh') return 'refresh';
  // Fail closed: never POST without an explicit resubmit + key.
  return phase.idempotencyKey ? 'resubmit' : 'refresh';
}

export async function retryAccountDeletionError(input: {
  phase: Extract<AccountDeletionUiPhase, { kind: 'error' }>;
  session: SessionBoundary;
  epoch: SessionEpoch;
  userId: string;
  fetchImpl?: typeof fetch;
}): Promise<AccountDeletionUiPhase> {
  const action = resolveAccountDeletionRetryAction(input.phase);
  if (action === 'resubmit' && input.phase.idempotencyKey) {
    return submitAccountDeletionRequest({
      session: input.session,
      epoch: input.epoch,
      userId: input.userId,
      idempotencyKey: input.phase.idempotencyKey,
      fetchImpl: input.fetchImpl,
    });
  }
  if (action === 'refresh') {
    return loadCurrentAccountDeletionRequest({
      session: input.session,
      epoch: input.epoch,
      fetchImpl: input.fetchImpl,
    });
  }
  return input.phase;
}
