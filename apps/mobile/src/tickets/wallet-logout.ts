import { session } from '../identity/session.ts';
import {
  clearTicketDisplayCache,
  invalidateTicketDisplayWrites,
} from './display-cache.ts';
import { invalidateOfflineBindingWrites } from './offline-display.ts';
import { offlineDisplay } from './offline-display-session.ts';

export type WalletLogoutInput = {
  userId: string | null;
  tenantId: string | null;
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
  invalidateTicketDisplayWrites();
  invalidateOfflineBindingWrites();
  offlineDisplay.invalidateMemory();

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

  if (input.userId && input.tenantId) {
    try {
      await clearTicketDisplayCache(input.userId, input.tenantId);
    } catch (error) {
      errors.push(asError(error, 'Xóa bộ đệm hiển thị vé thất bại'));
    }
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
