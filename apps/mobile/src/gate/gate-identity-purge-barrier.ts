/** Tracks verified account changes without treating unknown/unreachable as logout. */
export function createGateIdentityPurgeBarrier(
  beginPurge: (userId: string) => Promise<void>,
) {
  let lastVerifiedUser: string | null = null;
  let pending: Promise<void> = Promise.resolve();
  return {
    observe(verifiedUserId: string | null): void {
      if (!verifiedUserId) return;
      const previous = lastVerifiedUser;
      lastVerifiedUser = verifiedUserId;
      if (previous && previous !== verifiedUserId) {
        const next = beginPurge(previous);
        // A failed earlier delete cannot be forgotten by a later switch.
        pending = Promise.all([pending, next]).then(() => undefined);
        void pending.catch(() => undefined);
      }
    },
    wait(): Promise<void> { return pending; },
  };
}
