import type { FetchPublishedDetailResult } from './published-event-api.ts';
import type { PublishedEventDetail } from './types.ts';

export type PublishedDetailPhase =
  | { kind: 'loading' }
  | { kind: 'ready'; event: PublishedEventDetail }
  | { kind: 'not-found' }
  | { kind: 'misconfigured' }
  | { kind: 'error'; message: string; retryable: boolean };

/** A missing/unpublished link has one way back; retry is reserved for connectivity. */
export function publishedDetailPhaseFromResult(
  result: FetchPublishedDetailResult,
): PublishedDetailPhase {
  if (result.status === 'ok') return { kind: 'ready', event: result.event };
  if (result.status === 'not-found') return { kind: 'not-found' };
  if (result.status === 'misconfigured') return { kind: 'misconfigured' };
  return {
    kind: 'error',
    retryable: result.status === 'unreachable',
    message: result.status === 'unreachable'
      ? 'Không tải được sự kiện. Kiểm tra kết nối rồi thử lại.'
      : 'Không tải được sự kiện. Phản hồi không hợp lệ.',
  };
}
