import type { SessionBoundary } from '../identity/session-boundary.ts';
import { currentOfflineBindingWriteEpoch } from './offline-display.ts';
import type { OfflineDisplayBoundary } from './offline-display.ts';

/**
 * Capture offline-binding write epoch before an async verify/restore/establish,
 * then bind only if SessionBoundary is still verified for the expected user.
 */
export function captureOfflineBindingEpoch(): number {
  return currentOfflineBindingWriteEpoch();
}

export async function bindIfStillVerified(input: {
  session: SessionBoundary;
  offline: OfflineDisplayBoundary;
  userId: string;
  tenantId: string;
  bindingEpoch: number;
}): Promise<boolean> {
  const snap = input.session.getSnapshot();
  if (snap.status !== 'verified' || snap.userId !== input.userId) {
    return false;
  }
  return input.offline.bindAfterOnlineVerify(
    input.userId,
    input.tenantId,
    input.bindingEpoch,
  );
}
