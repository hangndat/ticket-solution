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
