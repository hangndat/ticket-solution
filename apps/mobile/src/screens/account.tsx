import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { MeResponse } from '@ticket/contracts';
import { Notice, Page } from '@/components/page';
import { SessionScopedPushStatus } from '@/push/push-status';
import { colors } from '@/theme/colors';
import { getTenantId, isOidcConfigured } from '@/identity/config';
import { fetchMe, verifyViaMe } from '@/identity/fetch-me';
import {
  endKeycloakSession,
  loginWithKeycloak,
} from '@/identity/oidc-login';
import { session } from '@/identity/session';
import {
  bindIfStillVerified,
  captureOfflineBindingEpoch,
} from '@/tickets/bind-after-verify';
import { offlineDisplay } from '@/tickets/offline-display-session';
import { logoutAndClearWalletArtifacts } from '@/tickets/wallet-logout';

function ActionButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: disabled
          ? colors.card
          : pressed
            ? colors.accent
            : colors.accent,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: '#fff',
          fontSize: 17,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AccountScreen() {
  const configured = isOidcConfigured();
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  if (!configured) {
    return (
      <Page>
        <Notice title="OIDC is not configured">
          Set EXPO_PUBLIC_OIDC_ISSUER and EXPO_PUBLIC_OIDC_CLIENT_ID in a local
          .env (see apps/mobile/.env.example). Without Keycloak config this
          build stays signed out and never stubs a verified user.
        </Notice>
        <Notice title="Identity status">
          Current SessionBoundary status: {identity.status}. No staff
          authorization is implied.
        </Notice>
        <SessionScopedPushStatus />
      </Page>
    );
  }

  return <ConfiguredAccount />;
}

function ConfiguredAccount() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const offline = useSyncExternalStore(
    offlineDisplay.subscribe,
    offlineDisplay.getSnapshot,
    offlineDisplay.getSnapshot,
  );
  const verifiedUserId =
    identity.status === 'verified' ? identity.userId : null;
  const isSignedIn = identity.status === 'verified' || accessToken !== null;

  // Refuse stale /v1/me UI immediately on identity switch (no effect delay).
  const visibleMe = useMemo(() => {
    if (identity.status !== 'verified' || !me) return null;
    return me.userId === identity.userId ? me : null;
  }, [identity, me]);

  const refreshMe = useCallback(async () => {
    setBusy(true);
    setMeError(null);
    const epoch = session.captureEpoch();
    try {
      // Online verified path only — never call API with offline-display auth.
      const token = await session.getCredential();
      if (!session.isEpochCurrent(epoch)) return;
      if (!token || !epoch) {
        setMe(null);
        setMeError(
          'No verified bearer in SessionBoundary. Offline display cannot authorize GET /v1/me.',
        );
        return;
      }
      const result = await fetchMe(token);
      if (!session.isEpochCurrent(epoch)) return;
      if (!result || result.userId !== epoch.userId) {
        setMe(null);
        setMeError(
          'GET /v1/me failed or returned an invalid body. Check EXPO_PUBLIC_API_BASE_URL and that the Nest JWT verifier is running.',
        );
        return;
      }
      setMe(result);
      setAccessToken(token);
    } finally {
      setBusy(false);
    }
  }, []);

  const onSignIn = useCallback(async () => {
    setBusy(true);
    setMe(null);
    setMeError(null);
    try {
      // Account switch: detach prior push + clear offline before hydrating a new user.
      try {
        const { clearApnsRegistrationState } = await import(
          '@/push/apns-device-token'
        );
        await clearApnsRegistrationState({ session });
      } catch {
        /* best-effort */
      }
      try {
        await offlineDisplay.clear();
      } catch {
        /* best-effort */
      }
      const bindingEpoch = captureOfflineBindingEpoch();
      const result = await loginWithKeycloak();
      if (!result.ok) {
        setMeError(result.reason);
        return;
      }
      setAccessToken(result.accessToken);
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
    } catch (error) {
      setMeError(
        error instanceof Error ? error.message : 'Keycloak sign-in failed.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const onLogout = useCallback(async () => {
    setBusy(true);
    setMe(null);
    setMeError(null);
    const userId =
      verifiedUserId ??
      (offline.status === 'bound' ? offline.userId : null);
    const tenantId =
      getTenantId() ??
      (offline.status === 'bound' ? offline.tenantId : null);
    try {
      await logoutAndClearWalletArtifacts({ userId, tenantId });
      setAccessToken(null);
      await endKeycloakSession();
    } catch (error) {
      setMeError(
        error instanceof Error
          ? error.message
          : 'Logout failed while clearing SecureStore / ticket cache.',
      );
    } finally {
      setBusy(false);
    }
  }, [offline, verifiedUserId]);

  return (
    <Page>
      <Notice title="D1 identity POC (Keycloak)">
        Authorization Code + PKCE via expo-auth-session against self-hosted
        Keycloak. Tokens use SecureStore (WHEN_UNLOCKED_THIS_DEVICE_ONLY).
        Verified app identity only after GET /v1/me — not from local JWT claims
        alone. No Clerk / SaaS IdP.
      </Notice>

      <Notice title="Session">
        Local bearer: {accessToken ? 'present' : 'none'}
        {'\n'}
        SessionBoundary: {identity.status}
        {verifiedUserId ? ` (${verifiedUserId})` : ''}
        {'\n'}
        Offline display:{' '}
        {offline.status === 'bound'
          ? `bound (${offline.userId})`
          : offline.status}
      </Notice>

      <View style={{ gap: 12 }}>
        {!isSignedIn ? (
          <ActionButton
            label="Sign in"
            onPress={() => void onSignIn()}
            disabled={busy}
          />
        ) : (
          <>
            <ActionButton
              label="Refresh GET /v1/me"
              onPress={() => void refreshMe()}
              disabled={busy || identity.status !== 'verified'}
            />
            <ActionButton
              label="Log out"
              onPress={() => void onLogout()}
              disabled={busy}
            />
          </>
        )}
        {!isSignedIn && offline.status === 'bound' ? (
          <ActionButton
            label="Log out (clear offline display)"
            onPress={() => void onLogout()}
            disabled={busy}
          />
        ) : null}
      </View>

      {busy ? (
        <View style={{ padding: 8, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : null}

      {meError ? <Notice title="Request failed">{meError}</Notice> : null}

      {visibleMe ? (
        <Notice title="GET /v1/me">
          userId: {visibleMe.userId}
          {'\n'}
          subject: {visibleMe.subject}
          {'\n'}
          issuer: {visibleMe.issuer}
          {'\n'}
          email: {visibleMe.email ?? '(none)'}
          {'\n'}
          emailVerified: {visibleMe.emailVerified ? 'true' : 'false'}
        </Notice>
      ) : null}

      <SessionScopedPushStatus />

      <Notice title="Not staff authorization">
        A verified SessionBoundary identity does not grant staff tools, tenant
        membership, or event permissions. Those come from PostgreSQL membership
        checks on the API.
      </Notice>
    </Page>
  );
}
