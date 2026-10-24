import { getTenantId, getTenantSlug } from '../identity/config.ts';
import { staffEligibility } from '../identity/staff-eligibility.ts';
import { session } from '../identity/session.ts';
import { clearCachedBranding } from '../theme/branding-cache.ts';
import { clearTicketDisplayCache, invalidateTicketDisplayWrites } from './display-cache.ts';
import { clearWalletDisplayCaches } from './wallet-display-persist.ts';
import type { MeTicketsFetchScope } from './wallet-fetch-scope.ts';
import { invalidateOfflineBindingWrites } from './offline-display.ts';
import { offlineDisplay } from './offline-display-session.ts';
import { offlineScanQueue } from '../gate/offline-queue-session.ts';
import { beginDurableGateLogout } from '../gate/staff-gate-workspace-store.ts';
import { captureLogoutSessionGuard } from './wallet-logout-transaction.ts';

export type WalletLogoutInput = {
  userId: string | null;
  /** Session / branding scope key (tenant UUID or owner sentinel). */
  tenantId: string | null;
  walletScope?: MeTicketsFetchScope | null;
  /** Distinct row.tenantId values from the last wallet list (for cache purge). */
  ticketTenantIds?: string[];
};

/** Invalidate memory and install the durable Gate purge fence before any await. */
export function logoutAndClearWalletArtifacts(input: WalletLogoutInput): Promise<void> {
  const logoutSession = captureLogoutSessionGuard(session);
  if (logoutSession.verifiedUserId && input.userId && logoutSession.verifiedUserId !== input.userId) {
    return Promise.reject(new Error('Phiên tài khoản đã đổi. Vui lòng thử lại.'));
  }
  const userId = logoutSession.verifiedUserId ?? input.userId;
  staffEligibility.reset();
  invalidateTicketDisplayWrites();
  invalidateOfflineBindingWrites();
  offlineDisplay.invalidateMemory();
  if (userId) offlineScanQueue.fenceForUser(userId);
  else offlineScanQueue.invalidateMemory();

  return beginDurableGateLogout(userId, logoutSession.generation, async () => {
    if (logoutSession.hasVerifiedEpoch()) {
      const { clearApnsRegistrationState } = await import('../push/apns-device-token.ts');
      if (logoutSession.hasVerifiedEpoch()) await clearApnsRegistrationState({
        session,
        shouldContinue: logoutSession.hasVerifiedEpoch,
      });
    }
    const { clearGuestClaimIntent } = await import('../redeem/claim-intent.ts');
    clearGuestClaimIntent();
    const { clearRedeemDraftIntent, clearGlobalRedeemDraftIntent } = await import('../redeem/redeem-draft-intent.ts');
    clearRedeemDraftIntent();
    clearGlobalRedeemDraftIntent();
    const { clearSignInReturn } = await import('../navigation/sign-in-return-intent.ts');
    clearSignInReturn();
    const { clearPendingImmediateSignIn } = await import('../navigation/attendee-auth-gate.ts');
    clearPendingImmediateSignIn();
    const { clearNotificationTapIntent } = await import('../push/notification-intent.ts');
    clearNotificationTapIntent();
    await offlineDisplay.clear();
    if (userId && input.walletScope) {
      await clearWalletDisplayCaches(userId, input.walletScope, input.ticketTenantIds ?? []);
    } else if (userId && input.tenantId) {
      await clearTicketDisplayCache(userId, input.tenantId);
    }
    const tenantId = (input.tenantId ?? getTenantId() ?? '').trim();
    const tenantSlug = (getTenantSlug() ?? '').trim();
    if (tenantId) await clearCachedBranding(`id:${tenantId}`);
    if (tenantSlug) await clearCachedBranding(`slug:${tenantSlug}`);
    if (logoutSession.isCurrent()) await session.logout();
  }).catch((cause: unknown) => {
    throw new Error('Chưa thể hoàn tất dọn dẹp đăng xuất. Vui lòng thử lại.', { cause });
  });
}
