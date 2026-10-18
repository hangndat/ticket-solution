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
        'Không xác định được kết quả do mạng chậm hoặc mất kết nối. Bạn có thể thử lại — hệ thống sẽ không tạo yêu cầu trùng. / Could not confirm the result (network). You can retry — we will not create a duplicate request.',
      retryable: true,
      retryAction: 'resubmit',
      idempotencyKey,
    };
  }
  if (result.status === 'unauthorized') {
    return {
      kind: 'error',
      message:
        'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại. / Your session is no longer valid. Please sign in again.',
      retryable: false,
    };
  }
  if (result.status === 'confirmation-required') {
    return {
      kind: 'error',
      message:
        'Máy chủ cần bạn xác nhận lại trước khi gửi yêu cầu. / The server needs you to confirm again before sending the request.',
      retryable: false,
    };
  }
  if (result.status === 'idempotency-key-required') {
    return {
      kind: 'error',
      message:
        'Thiếu khóa an toàn để gửi yêu cầu. Hãy thử lại từ đầu. / A safety key is missing. Please start the request again.',
      retryable: false,
    };
  }
  if (result.status === 'idempotency-conflict') {
    return {
      kind: 'error',
      message:
        'Yêu cầu trùng khóa nhưng nội dung khác. Hãy thử lại từ đầu. / A conflicting retry was blocked. Please start the request again.',
      retryable: false,
      idempotencyKey,
    };
  }
  return {
    kind: 'unavailable',
    message:
      'Không dùng được dịch vụ yêu cầu xóa lúc này. Ứng dụng không giả định tài khoản đã bị xóa. / Account deletion is unavailable right now. The app does not assume your account was wiped.',
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
      message:
        'Không tải được trạng thái yêu cầu (mạng chậm hoặc mất kết nối). / Could not load request status (network).',
      retryable: true,
      retryAction: 'refresh',
    };
  }
  if (result.status === 'unauthorized') {
    return {
      kind: 'error',
      message:
        'Phiên đăng nhập không hợp lệ khi đọc yêu cầu xóa. / Your session is not valid for reading the deletion request.',
      retryable: false,
    };
  }
  return {
    kind: 'unavailable',
    message:
      'Không đọc được trạng thái yêu cầu xóa lúc này. Ứng dụng không bịa trạng thái đã xóa. / Deletion status is unavailable. The app will not invent a wiped state.',
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
