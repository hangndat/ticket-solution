import { useCallback, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { MeResponse } from '@ticket/contracts';
import { Notice, Page } from '@/components/page';
import { colors } from '@/theme/colors';
import { isOidcConfigured } from '@/identity/config';
import { fetchMe, verifyViaMe } from '@/identity/fetch-me';
import {
  endKeycloakSession,
  loginWithKeycloak,
} from '@/identity/oidc-login';
import { session } from '@/identity/session';

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
  const verifiedUserId =
    identity.status === 'verified' ? identity.userId : null;
  const isSignedIn = identity.status === 'verified' || accessToken !== null;

  const refreshMe = useCallback(async () => {
    setBusy(true);
    setMeError(null);
    try {
      const token = accessToken;
      if (!token) {
        setMe(null);
        setMeError('No short-lived bearer. Sign in first.');
        return;
      }
      const result = await fetchMe(token);
      if (!result) {
        setMe(null);
        setMeError(
          'GET /v1/me failed or returned an invalid body. Check EXPO_PUBLIC_API_BASE_URL and that the Nest JWT verifier is running.',
        );
        return;
      }
      setMe(result);
    } finally {
      setBusy(false);
    }
  }, [accessToken]);

  const onSignIn = useCallback(async () => {
    setBusy(true);
    setMe(null);
    setMeError(null);
    try {
      const result = await loginWithKeycloak();
      if (!result.ok) {
        setMeError(result.reason);
        return;
      }
      setAccessToken(result.accessToken);
      await session.establish(result.accessToken, verifyViaMe);
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
    try {
      await session.logout();
      setAccessToken(null);
      await endKeycloakSession();
    } catch (error) {
      setMeError(
        error instanceof Error
          ? error.message
          : 'Logout failed while clearing SecureStore.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

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
              disabled={busy}
            />
            <ActionButton
              label="Log out"
              onPress={() => void onLogout()}
              disabled={busy}
            />
          </>
        )}
      </View>

      {busy ? (
        <View style={{ padding: 8, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : null}

      {meError ? <Notice title="Request failed">{meError}</Notice> : null}

      {me ? (
        <Notice title="GET /v1/me">
          userId: {me.userId}
          {'\n'}
          subject: {me.subject}
          {'\n'}
          issuer: {me.issuer}
          {'\n'}
          email: {me.email ?? '(none)'}
          {'\n'}
          emailVerified: {me.emailVerified ? 'true' : 'false'}
        </Notice>
      ) : null}

      <Notice title="Not staff authorization">
        A verified SessionBoundary identity does not grant staff tools, tenant
        membership, or event permissions. Those come from PostgreSQL membership
        checks on the API.
      </Notice>
    </Page>
  );
}
