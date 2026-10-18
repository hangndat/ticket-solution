import { useEffect } from 'react';
import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { getTenantId, isOidcConfigured } from '@/identity/config';
import { verifyViaMe } from '@/identity/fetch-me';
import { session } from '@/identity/session';
import '@/push/push-notifications-init';
import { attachNotificationRouting } from '@/push/notification-routing';
import { ThemeProvider } from '@/theme/ThemeProvider';
import {
  bindIfStillVerified,
  captureOfflineBindingEpoch,
} from '@/tickets/bind-after-verify';
import { offlineDisplay } from '@/tickets/offline-display-session';

function AppStack() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="events/[tenantSlug]/[slug]"
        options={{ title: 'Chi tiết sự kiện' }}
      />
      <Stack.Screen
        name="events/fixture/[eventId]"
        options={{ title: 'Sự kiện demo' }}
      />
      <Stack.Screen name="redeem" options={{ title: 'Đổi mã' }} />
      <Stack.Screen name="claim" options={{ title: 'Nhận vé mời' }} />
      <Stack.Screen
        name="staff-access"
        options={{ title: 'Nhân viên', headerLargeTitle: true }}
      />
      <Stack.Screen
        name="uat/session"
        options={{ title: 'UAT session', headerShown: false }}
      />
    </Stack>
  );
}

/**
 * Cold-start bootstrap:
 * - Hydrate offline-display binding (never elevates SessionBoundary).
 * - restore(verifyViaMe): verified | signed-out (401/403) | unreachable (network).
 * - unauthorized/signed-out clears offline binding; unreachable keeps binding for display.
 * - Push tap cold/warm listener (C-N) — never gates wallet on permission/denied.
 */
export default function RootLayout() {
  const configured = isOidcConfigured();

  useEffect(() => {
    let stopRouting: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const handle = await attachNotificationRouting({
          session,
          navigate: (href) => {
            try {
              // Href is a validated published/ticket path from resolve — not fixture.
              router.push(href as never);
            } catch {
              /* Navigation must never crash wallet bootstrap. */
            }
          },
        });
        if (cancelled) {
          handle.stop();
          return;
        }
        stopRouting = () => handle.stop();
      } catch {
        /* Missing native notifications module → wallet still works. */
      }
    })();

    return () => {
      cancelled = true;
      stopRouting?.();
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await offlineDisplay.hydrate();
      } catch {
        /* Binding hydrate failure → treat as none; never invent verified. */
      }

      if (!configured) {
        void session.restore().then(async (outcome) => {
          if (outcome === 'signed-out') {
            try {
              await offlineDisplay.clear();
            } catch {
              /* best-effort */
            }
          }
        });
        return;
      }

      try {
        const tenantId = getTenantId();
        // Capture before async restore so a concurrent logout cannot be bypassed.
        const bindingEpoch = captureOfflineBindingEpoch();
        const outcome = await session.restore(verifyViaMe);
        const identity = session.getSnapshot();

        if (outcome === 'verified' && identity.status === 'verified') {
          if (tenantId) {
            await bindIfStillVerified({
              session,
              offline: offlineDisplay,
              userId: identity.userId,
              tenantId,
              bindingEpoch,
            });
          }
          return;
        }

        if (outcome === 'unreachable') {
          // Keep prior offline binding for display-only wallet. No API auth.
          return;
        }

        // signed-out / unknown after rejected auth — fail closed for offline too.
        if (outcome === 'signed-out') {
          await offlineDisplay.clear();
        }
      } catch {
        /* Remain unknown on storage failure; never stub verified. */
      }
    })();
  }, [configured]);

  return (
    <ThemeProvider>
      <AppStack />
    </ThemeProvider>
  );
}
