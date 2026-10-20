import { getTenantId, getTenantSlug } from '../identity/config.ts';
import { staffEligibility } from '../identity/staff-eligibility.ts';
import { session } from '../identity/session.ts';
import { clearCachedBranding } from '../theme/branding-cache.ts';
import {
  clearTicketDisplayCache,
  invalidateTicketDisplayWrites,
} from './display-cache.ts';
import { clearWalletDisplayCaches } from './wallet-display-persist.ts';
import type { MeTicketsFetchScope } from './wallet-fetch-scope.ts';
import { invalidateOfflineBindingWrites } from './offline-display.ts';
import { offlineDisplay } from './offline-display-session.ts';
import { offlineScanQueue } from '../gate/offline-queue-session.ts';

export type WalletLogoutInput = {
  userId: string | null;
  /** Session / branding scope key (tenant UUID or owner sentinel). */
  tenantId: string | null;
  walletScope?: MeTicketsFetchScope | null;
  /** Distinct row.tenantId values from the last wallet list (for cache purge). */
  ticketTenantIds?: string[];
};

function asError(value: unknown, fallback: string): Error {
  return value instanceof Error ? value : new Error(fallback);
}

/**
 * Logout from every wallet entry point:
 * 1) Invalidate durable write gates (block late cache/binding resurrection)
 * 2) Fail-closed offline memory immediately (UI must not keep prior binding)
 * 3) Attempt session logout + durable binding/cache clears independently
 *
 * Bearer deletion failure must not skip binding/cache cleanup. Aggregate errors
 * so callers never claim durable logout succeeded when any step failed.
 */
export async function logoutAndClearWalletArtifacts(
  input: WalletLogoutInput,
): Promise<void> {
  staffEligibility.reset();
  invalidateTicketDisplayWrites();
  invalidateOfflineBindingWrites();
  offlineDisplay.invalidateMemory();
  offlineScanQueue.invalidateMemory();

  const errors: Error[] = [];

  // Detach push while the bearer is still readable (before session.logout).
  try {
    const { clearApnsRegistrationState } = await import(
      '../push/apns-device-token.ts'
    );
    await clearApnsRegistrationState({ session });
  } catch (error) {
    errors.push(asError(error, 'Gỡ đăng ký APNs thất bại'));
  }

  // Drop guest claim login-return intent + answers isolation (C-I).
  try {
    const { clearGuestClaimIntent } = await import('../redeem/claim-intent.ts');
    clearGuestClaimIntent();
  } catch (error) {
    errors.push(asError(error, 'Xóa intent claim khách thất bại'));
  }

  try {
    const { clearRedeemDraftIntent, clearGlobalRedeemDraftIntent } =
      await import('../redeem/redeem-draft-intent.ts');
    clearRedeemDraftIntent();
    clearGlobalRedeemDraftIntent();
  } catch (error) {
    errors.push(asError(error, 'Xóa draft đổi mã thất bại'));
  }

  try {
    const { clearSignInReturn } = await import(
      '../navigation/sign-in-return-intent.ts'
    );
    clearSignInReturn();
  } catch (error) {
    errors.push(asError(error, 'Xóa lộ trình quay lại sau đăng nhập thất bại'));
  }

  try {
    const { clearPendingImmediateSignIn } = await import(
      '../navigation/attendee-auth-gate.ts'
    );
    clearPendingImmediateSignIn();
  } catch (error) {
    errors.push(asError(error, 'Xóa cổng đăng nhập ngữ cảnh thất bại'));
  }

  // Drop push tap login-return intent (C-N) so late resolve cannot route prior user.
  try {
    const { clearNotificationTapIntent } = await import(
      '../push/notification-intent.ts'
    );
    clearNotificationTapIntent();
  } catch (error) {
    errors.push(asError(error, 'Xóa intent chạm thông báo thất bại'));
  }

  try {
    await session.logout();
  } catch (error) {
    errors.push(asError(error, 'Đăng xuất phiên thất bại'));
  }

  try {
    await offlineDisplay.clear();
  } catch (error) {
    errors.push(asError(error, 'Xóa liên kết hiển thị offline thất bại'));
  }

  if (input.userId) {
    try {
      await offlineScanQueue.clearForUser(input.userId);
    } catch (error) {
      errors.push(asError(error, 'Xóa hàng đợi quét offline thất bại'));
    }
  }

  if (input.userId) {
    try {
      if (input.walletScope) {
        await clearWalletDisplayCaches(
          input.userId,
          input.walletScope,
          input.ticketTenantIds ?? [],
        );
      } else if (input.tenantId) {
        await clearTicketDisplayCache(input.userId, input.tenantId);
      }
    } catch (error) {
      errors.push(asError(error, 'Xóa bộ đệm hiển thị vé thất bại'));
    }
  }

  // S-P0-C: drop durable tenant brand cache so next session cannot flash prior chrome.
  try {
    const tenantId = (input.tenantId ?? getTenantId() ?? '').trim();
    const tenantSlug = (getTenantSlug() ?? '').trim();
    if (tenantId) await clearCachedBranding(`id:${tenantId}`);
    if (tenantSlug) await clearCachedBranding(`slug:${tenantSlug}`);
  } catch (error) {
    errors.push(asError(error, 'Xóa bộ đệm brand thất bại'));
  }

  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new Error(
      `Dọn dẹp đăng xuất thất bại (${errors.length} bước): ${errors
        .map((error) => error.message)
        .join('; ')}`,
    );
  }
}
