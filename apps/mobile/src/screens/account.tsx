import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import type { MeResponse } from '@ticket/contracts';
import { Notice, Page } from '@/components/page';
import { SessionScopedAccountDeletionPanel } from '@/account-deletion/account-deletion-panel';
import { PRIVACY_POLICY_URL } from '@/account-deletion/privacy-policy';
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

  if (!configured) {
    return (
      <Page>
        <Notice title="Chưa cấu hình đăng nhập">
          Thiếu cấu hình đăng nhập trên bản dựng này. Ứng dụng giữ trạng thái
          đăng xuất và không giả lập tài khoản.
        </Notice>
        <Text style={{ color: colors.secondary, fontSize: 15 }}>
          Trạng thái: chưa đăng nhập
        </Text>
        <SessionScopedPushStatus />
        <PrivacyPolicyLink />
      </Page>
    );
  }

  return <ConfiguredAccount />;
}

function ConfiguredAccount() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
          'Chưa có phiên đã xác minh. Đăng nhập lại khi có mạng — chế độ xem offline không tải hồ sơ.',
        );
        return;
      }
      const result = await fetchMe(token);
      if (!session.isEpochCurrent(epoch)) return;
      if (!result || result.userId !== epoch.userId) {
        setMe(null);
        setMeError(
          'Không tải được hồ sơ tài khoản. Kiểm tra kết nối rồi thử lại.',
        );
        return;
      }
      setMe(result);
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
      await session.establish(result.accessToken, verifyViaMe);
      const snap = session.getSnapshot();
      if (snap.status !== 'verified') {
        // Unreachable establish still persists the bearer; do not pretend signed-in.
        setMeError(
          getApiBaseUrl()
            ? 'Đăng nhập xong nhưng chưa xác minh hồ sơ (mạng hoặc máy chủ). Thử lại khi có mạng.'
            : 'Đăng nhập xong nhưng bản dựng thiếu địa chỉ API. Không xác minh được phiên.',
        );
        return;
      }
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
        error instanceof Error ? error.message : 'Đăng nhập thất bại.',
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
      await endKeycloakSession();
    } catch (error) {
      setMeError(
        error instanceof Error
          ? error.message
          : 'Đăng xuất thất bại khi xóa dữ liệu cục bộ.',
      );
    } finally {
      setBusy(false);
    }
  }, [offline, verifiedUserId]);

  const sessionLabel = isSignedIn
    ? 'Đã đăng nhập'
    : offline.status === 'bound'
      ? 'Xem offline (chưa xác minh phiên)'
      : 'Chưa đăng nhập';

  return (
    <Page>
      <Notice title="Tài khoản">
        Đăng nhập để xem vé và bật thông báo. Danh tính chỉ xác minh sau khi máy
        chủ xác nhận hồ sơ — không chỉ từ token lưu trên máy.
      </Notice>

      <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 22 }}>
        Trạng thái: {sessionLabel}
        {visibleMe?.email ? `\nEmail: ${visibleMe.email}` : ''}
        {visibleMe
          ? `\nEmail đã xác minh: ${visibleMe.emailVerified ? 'có' : 'chưa'}`
          : ''}
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
              label="Làm mới hồ sơ"
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

      <SessionScopedPushStatus />

      <PrivacyPolicyLink />

      {identity.status === 'verified' ? (
        <SessionScopedAccountDeletionPanel />
      ) : null}

      <Notice title="Không phải quyền nhân viên">
        Đăng nhập không tự cấp quyền nhân viên hay quản lý tổ chức. Các quyền đó
        do máy chủ kiểm tra riêng.
      </Notice>
    </Page>
  );
}

/** In-app entry to the public Privacy Policy (Guideline 5.1.1 companion). */
function PrivacyPolicyLink() {
  const [error, setError] = useState<string | null>(null);
  const onOpen = useCallback(async () => {
    setError(null);
    try {
      const supported = await Linking.canOpenURL(PRIVACY_POLICY_URL);
      if (!supported) {
        setError(`Không mở được ${PRIVACY_POLICY_URL}`);
        return;
      }
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không mở được Chính sách quyền riêng tư.',
      );
    }
  }, []);

  return (
    <View style={{ gap: 8 }}>
      <ActionButton
        label="Chính sách quyền riêng tư"
        onPress={() => void onOpen()}
      />
      <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 18 }}>
        Mở trang Chính sách quyền riêng tư công khai.
      </Text>
      {error ? <Notice title="Không mở được liên kết">{error}</Notice> : null}
    </View>
  );
}
