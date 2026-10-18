import { useCallback, useState } from 'react';
import { getTenantId, isOidcConfigured } from '@/identity/config';
import { verifyViaMe } from '@/identity/fetch-me';
import { loginWithKeycloak } from '@/identity/oidc-login';
import { session } from '@/identity/session';
import {
  bindIfStillVerified,
  captureOfflineBindingEpoch,
} from '@/tickets/bind-after-verify';
import { offlineDisplay } from '@/tickets/offline-display-session';

export type AttendeeSignInState = {
  busy: boolean;
  error: string | null;
  configured: boolean;
  signIn: () => Promise<boolean>;
  clearError: () => void;
};

/**
 * OIDC sheet on the current stack (AC-S2) — shared by Events / Redeem / Ví.
 * Success returns true so callers can clear auth-denied UI on the same surface (AC-S1).
 */
export function useAttendeeSignIn(): AttendeeSignInState {
  const configured = isOidcConfigured();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const signIn = useCallback(async (): Promise<boolean> => {
    if (!configured) {
      setError('Chưa cấu hình đăng nhập trên bản dựng này.');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      try {
        await offlineDisplay.clear();
      } catch {
        /* continue sign-in; prior binding clear best-effort */
      }
      const bindingEpoch = captureOfflineBindingEpoch();
      const result = await loginWithKeycloak();
      if (!result.ok) {
        setError(
          result.reason === 'Đã hủy đăng nhập.'
            ? 'Không đăng nhập được — đã hủy. Thử lại hoặc ở lại màn này.'
            : result.reason || 'Không đăng nhập được.',
        );
        return false;
      }
      await session.establish(result.accessToken, verifyViaMe);
      const snap = session.getSnapshot();
      const tenantId = getTenantId();
      if (snap.status === 'verified' && tenantId) {
        await bindIfStillVerified({
          session,
          offline: offlineDisplay,
          userId: snap.userId,
          tenantId,
          bindingEpoch,
        });
      }
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không đăng nhập được.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, [configured]);

  return { busy, error, configured, signIn, clearError };
}
