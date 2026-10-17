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
    errors.push(asError(error, 'APNs registration detach failed'));
  }

  try {
    await session.logout();
  } catch (error) {
    errors.push(asError(error, 'Session logout failed'));
  }

  try {
    await offlineDisplay.clear();
  } catch (error) {
    errors.push(asError(error, 'Offline display binding clear failed'));
  }

  if (input.userId && input.tenantId) {
    try {
      await clearTicketDisplayCache(input.userId, input.tenantId);
    } catch (error) {
      errors.push(asError(error, 'Ticket display cache clear failed'));
    }
  }

  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new Error(
      `Logout cleanup failed (${errors.length} steps): ${errors
        .map((error) => error.message)
        .join('; ')}`,
    );
  }
}
