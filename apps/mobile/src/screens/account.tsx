import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { MeResponse } from '@ticket/contracts';
import { Notice, Page } from '@/components/page';
import { SessionScopedAccountDeletionPanel } from '@/account-deletion/account-deletion-panel';
import { SessionScopedPushStatus } from '@/push/push-status';
import { colors } from '@/theme/colors';
import { getApiBaseUrl, getTenantId, isOidcConfigured } from '@/identity/config';
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
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: disabled ? colors.card : colors.accent,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        borderWidth: focused ? 2 : 0,
        borderColor: colors.focus,
      })}
    >
      <Text
        style={{
          color: colors.onAccent,
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
        <Notice title="Chưa cấu hình OIDC">
          Đặt EXPO_PUBLIC_OIDC_ISSUER và EXPO_PUBLIC_OIDC_CLIENT_ID (xem
          .env.example). Không có Keycloak thì build giữ đăng xuất và không giả
          lập user.
        </Notice>
        <Text style={{ color: colors.secondary, fontSize: 15 }}>
          Phiên: {identity.status}
        </Text>
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
  // Only SessionBoundary verified counts — local OIDC token alone is not signed-in.
  const isSignedIn = identity.status === 'verified';

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
          'Không có bearer đã xác minh trong SessionBoundary. Hiển thị offline không được gọi GET /v1/me.',
        );
        return;
      }
      const result = await fetchMe(token);
      if (!session.isEpochCurrent(epoch)) return;
      if (!result || result.userId !== epoch.userId) {
        setMe(null);
        setMeError(
          'GET /v1/me thất bại hoặc body không hợp lệ. Kiểm tra EXPO_PUBLIC_API_BASE_URL và Nest JWT verifier.',
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
        setAccessToken(null);
        setMeError(result.reason);
        return;
      }
      await session.establish(result.accessToken, verifyViaMe);
      const snap = session.getSnapshot();
      if (snap.status !== 'verified') {
        // Unreachable establish still persists the bearer; do not pretend signed-in.
        setAccessToken(null);
        setMeError(
          getApiBaseUrl()
            ? 'OIDC ok nhưng GET /v1/me chưa xác minh (mạng/API). Thử lại khi online — token đã giữ trong SecureStore.'
            : 'OIDC ok nhưng thiếu EXPO_PUBLIC_API_BASE_URL (bake Release). Không xác minh được phiên.',
        );
        return;
      }
      setAccessToken(result.accessToken);
      const tenantId = getTenantId();
      if (tenantId) {
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
        error instanceof Error ? error.message : 'Đăng nhập Keycloak thất bại.',
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
          : 'Đăng xuất thất bại khi xóa SecureStore / bộ đệm vé.',
      );
    } finally {
      setBusy(false);
    }
  }, [offline, verifiedUserId]);

  return (
    <Page>
      <Notice title="Tài khoản">
        Đăng nhập Keycloak (PKCE). Danh tính app chỉ xác minh sau GET /v1/me —
        không chỉ từ JWT local.
      </Notice>

      <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 22 }}>
        Bearer: {accessToken ? 'có' : 'không'}
        {'\n'}
        Phiên: {identity.status}
        {verifiedUserId ? ` (${verifiedUserId})` : ''}
        {'\n'}
        Offline:{' '}
        {offline.status === 'bound'
          ? `đã liên kết (${offline.userId})`
          : offline.status}
      </Text>

      <View style={{ gap: 12 }}>
        {!isSignedIn ? (
          <ActionButton
            label="Đăng nhập"
            onPress={() => void onSignIn()}
            disabled={busy}
          />
        ) : (
          <>
            <ActionButton
              label="Làm mới GET /v1/me"
              onPress={() => void refreshMe()}
              disabled={busy || identity.status !== 'verified'}
            />
            <ActionButton
              label="Đăng xuất"
              onPress={() => void onLogout()}
              disabled={busy}
            />
          </>
        )}
        {!isSignedIn && offline.status === 'bound' ? (
          <ActionButton
            label="Đăng xuất (xoá hiển thị offline)"
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

      {meError ? <Notice title="Yêu cầu thất bại">{meError}</Notice> : null}

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

      {identity.status === 'verified' ? (
        <SessionScopedAccountDeletionPanel />
      ) : null}

      <Notice title="Không phải quyền nhân viên">
        Phiên đã xác minh không cấp quyền staff, membership tenant hay sự kiện.
        Các quyền đó đến từ kiểm tra membership trên API.
      </Notice>
    </Page>
  );
}
