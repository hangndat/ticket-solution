import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Linking,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import type { MeResponse } from '@ticket/contracts';
import { AttendeeCta } from '@/components/attendee-cta';
import { BrandWordmark, Notice, Page } from '@/components/page';
import { SessionScopedAccountDeletionPanel } from '@/account-deletion/account-deletion-panel';
import { PRIVACY_POLICY_URL } from '@/account-deletion/privacy-policy';
import { SessionScopedPushStatus } from '@/push/push-status';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { typography } from '@/theme/typography';
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

/**
 * Account — Phase 2 full visual (Live Pulse).
 * Session status, login/logout, redeem deep-link, push, privacy, deletion.
 */
export function AccountScreen() {
  const configured = isOidcConfigured();

  if (!configured) {
    return (
      <Page>
        <BrandWordmark />
        <Text
          accessibilityRole="header"
          style={{ color: brand.ink, ...typography.display }}
        >
          Tài khoản
        </Text>
        <Text style={{ color: colors.secondary, ...typography.body }}>
          Phiên đăng nhập · chính sách quyền riêng tư
        </Text>
        <Notice title="Chưa cấu hình đăng nhập">
          Thiếu cấu hình đăng nhập trên bản dựng này. Ứng dụng giữ trạng thái
          đăng xuất và không giả lập tài khoản.
        </Notice>
        <Text
          style={{
            color: colors.secondary,
            fontFamily: fontFamilies.body,
            fontSize: 15,
          }}
        >
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
    ? 'Bạn đang đăng nhập'
    : offline.status === 'bound'
      ? 'Xem offline (chưa xác minh phiên)'
      : 'Chưa đăng nhập';

  const sessionSupport = isSignedIn
    ? 'Phiên đã xác minh trên máy chủ — không chỉ từ token lưu máy.'
    : offline.status === 'bound'
      ? 'Có bộ đệm vé offline; chưa phải phiên đăng nhập đã xác minh.'
      : 'Đăng nhập để xem vé và quản lý tài khoản.';

  return (
    <Page>
      <BrandWordmark />
      <Text
        accessibilityRole="header"
        style={{ color: brand.ink, ...typography.display }}
      >
        Tài khoản
      </Text>
      <Text style={{ color: colors.secondary, ...typography.body }}>
        {sessionSupport}
      </Text>

      <View
        style={{
          gap: 14,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.separator,
          paddingVertical: 16,
        }}
      >
        <Text
          style={{
            color: brand.ink,
            fontFamily: fontFamilies.display,
            fontSize: 18,
            fontWeight: '600',
          }}
        >
          Phiên
        </Text>
        <Text
          style={{
            color: colors.secondary,
            fontFamily: fontFamilies.body,
            fontSize: 15,
            lineHeight: 22,
          }}
          accessibilityLiveRegion="polite"
        >
          {sessionLabel}
          {visibleMe?.email ? `\n${visibleMe.email}` : ''}
          {visibleMe
            ? `\nEmail đã xác minh: ${visibleMe.emailVerified ? 'có' : 'chưa'}`
            : ''}
        </Text>

        <View style={{ gap: 10 }}>
          {!isSignedIn ? (
            <AttendeeCta
              label="Đăng nhập"
              onPress={() => void onSignIn()}
              disabled={busy}
              testID="account-cta-signin"
            />
          ) : (
            <>
              <AttendeeCta
                label="Làm mới hồ sơ"
                variant="secondary"
                onPress={() => void refreshMe()}
                disabled={busy || identity.status !== 'verified'}
                testID="account-cta-refresh"
              />
              <AttendeeCta
                label="Đăng xuất"
                onPress={() => void onLogout()}
                disabled={busy}
                testID="account-cta-logout"
              />
            </>
          )}
          {!isSignedIn && offline.status === 'bound' ? (
            <AttendeeCta
              label="Đăng xuất (xoá hiển thị offline)"
              variant="secondary"
              onPress={() => void onLogout()}
              disabled={busy}
              testID="account-cta-logout-offline"
            />
          ) : null}
          <AttendeeCta
            label="Đổi mã lấy vé"
            variant="secondary"
            onPress={() => router.push('/redeem-global')}
            testID="account-cta-redeem"
          />
        </View>
      </View>

      {busy ? (
        <View style={{ padding: 8, alignItems: 'center' }}>
          <ActivityIndicator color={brand.signal} />
          <Text
            style={{
              marginTop: 8,
              color: colors.secondary,
              ...typography.caption,
            }}
          >
            Đang xử lý…
          </Text>
        </View>
      ) : null}

      {meError ? (
        <View accessibilityLiveRegion="assertive" accessibilityRole="alert">
          <Notice title="Không tải được phiên" tone="deny">
            {meError}
          </Notice>
        </View>
      ) : null}

      <SessionScopedPushStatus />

      <PrivacyPolicyLink />

      {identity.status === 'verified' ? (
        <View style={{ gap: 12 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: brand.ink,
              fontFamily: fontFamilies.display,
              fontSize: 20,
              fontWeight: '600',
            }}
          >
            Yêu cầu xóa tài khoản
          </Text>
          <SessionScopedAccountDeletionPanel />
        </View>
      ) : null}

      <Text
        style={{
          color: colors.secondary,
          fontSize: 13,
          lineHeight: 18,
          fontFamily: fontFamilies.body,
        }}
      >
        Đăng nhập không tự cấp quyền nhân viên hay quản lý tổ chức. Các quyền đó
        do máy chủ kiểm tra riêng.
      </Text>
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
      <AttendeeCta
        label="Chính sách quyền riêng tư"
        variant="secondary"
        onPress={() => void onOpen()}
        testID="account-cta-privacy"
      />
      <Text style={{ color: colors.secondary, ...typography.caption }}>
        Mở trang Chính sách quyền riêng tư công khai.
      </Text>
      {error ? <Notice title="Không mở được liên kết">{error}</Notice> : null}
    </View>
  );
}

/** Re-export for wallet surfaces that need privacy without full account chrome. */
export { PrivacyPolicyLink as AccountPrivacyPolicyLink };
