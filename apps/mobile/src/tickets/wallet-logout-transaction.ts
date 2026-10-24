import type { SessionBoundary } from '../identity/session-boundary.ts';

type CleanupStep = { failure: string; run: () => Promise<void> };

/** An explicit logout also clears a retained credential after unreachable restore. */
export function captureLogoutSessionGuard(boundary: Pick<SessionBoundary, 'captureEpoch' | 'getSnapshot' | 'isEpochCurrent'>) {
  const epoch = boundary.captureEpoch();
  const identity = boundary.getSnapshot();
  return {
    generation: epoch?.generation,
    verifiedUserId: epoch?.userId ?? null,
    isCurrent: () => epoch ? boundary.isEpochCurrent(epoch) : boundary.getSnapshot() === identity,
    hasVerifiedEpoch: () => !!epoch && boundary.isEpochCurrent(epoch),
  };
}

export type WalletLogoutTransactionInput = {
  userId: string | null;
  sessionGeneration?: number;
  beginPurge: (userId: string, generation: number | undefined, beforeDelete: () => Promise<void>) => Promise<void>;
  beforeSessionLogout: CleanupStep[];
  isSessionCurrent: () => boolean;
  logoutSession: () => Promise<void>;
  afterSessionLogout: CleanupStep[];
};

/** The production logout path installs its Gate fence synchronously. */
export function startWalletLogoutTransaction(input: WalletLogoutTransactionInput): Promise<void> {
  const errors: Error[] = [];
  const attempt = async (step: CleanupStep) => {
    try {
      await step.run();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(step.failure));
    }
  };
  const purge = input.beginPurge(input.userId ?? '', input.sessionGeneration, async () => {
    for (const step of input.beforeSessionLogout) await attempt(step);
    // APNs may have awaited while the user reauthenticated. The old logout
    // must never invalidate or delete credentials belonging to that session.
    if (input.isSessionCurrent()) {
      await attempt({ failure: 'Đăng xuất phiên thất bại', run: input.logoutSession });
    }
    for (const step of input.afterSessionLogout) await attempt(step);
  });
  return purge.then(
    () => {
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new Error(`Dọn dẹp đăng xuất thất bại (${errors.length} bước): ${errors.map((error) => error.message).join('; ')}`);
    },
    (error: unknown) => {
      errors.push(error instanceof Error ? error : new Error('Xóa lịch sử cổng trên máy thất bại'));
      if (errors.length === 1) throw errors[0];
      throw new Error(`Dọn dẹp đăng xuất thất bại (${errors.length} bước): ${errors.map((item) => item.message).join('; ')}`);
    },
  );
}
