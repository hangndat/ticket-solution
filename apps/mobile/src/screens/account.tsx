import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { MeResponse } from '@ticket/contracts';
import { AttendeeCta } from '@/components/attendee-cta';
import {
  AccountGroupedDivider,
  AccountGroupedRow,
  AccountGroupedSection,
} from '@/components/account-grouped-section';
import { Notice, Page } from '@/components/page';
import { accountCopy } from '@/components/screen-state-copy';
import { brand, colors } from '@/theme/colors';
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
import { consumePendingImmediateSignIn } from '@/navigation/attendee-auth-gate';
import { consumeSignInReturn } from '@/navigation/sign-in-return-intent';
import { STAFF_ACCOUNT_HREF } from '@/navigation/staff-account-route';
import { useStaffWorkspace } from '@/navigation/use-staff-workspace';
import { TabStackTitle } from '@/navigation/tab-stack-title';
import { useAttendeeTabBarInset } from '@/navigation/use-attendee-tab-bar-inset';
import { PushAccountSection } from '@/push/push-account-section';

export type AccountPresentation = 'tab' | 'stack';

export function AccountScreen({
  presentation = 'tab',
}: {
  presentation?: AccountPresentation;
}) {
  const configured = isOidcConfigured();

  if (!configured) {
    return (
      <>
        <MisconfiguredAccount presentation={presentation} />
        {presentation === 'tab' ? (
          <TabStackTitle title={accountCopy.screenTitle} />
        ) : null}
      </>
    );
  }

  return <ConfiguredAccount presentation={presentation} />;
}

function MisconfiguredAccount({
  presentation,
}: {
  presentation: AccountPresentation;
}) {
  return (
    <Page>
      <Notice title={accountCopy.misconfiguredTitle}>
        {accountCopy.misconfiguredBody}
      </Notice>
      <PushAccountSection identityKind="guest" />
      <AccountGroupedSection title={accountCopy.sections.privacy}>
        <AccountGroupedRow
          label={accountCopy.privacyRow}
          showChevron
          onPress={() => router.push('/(tabs)/account/privacy')}
          testID="account-cta-privacy"
        />
      </AccountGroupedSection>
      {presentation === 'tab' ? null : (
        <TabStackTitle title={accountCopy.screenTitle} />
      )}
    </Page>
  );
}

function navigateAfterSignIn(presentation: AccountPresentation) {
  const target = consumeSignInReturn();
  if (target?.pathname) {
    router.replace(target.pathname as never);
    return;
  }
  if (presentation === 'stack') {
    router.back();
  }
}

function ConfiguredAccount({
  presentation,
}: {
  presentation: AccountPresentation;
}) {
  const staffWorkspace = useStaffWorkspace();
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
  const isSignedIn = identity.status === 'verified';

  const visibleMe = useMemo(() => {
    if (identity.status !== 'verified' || !me) return null;
    return me.userId === identity.userId ? me : null;
  }, [identity, me]);

  const refreshMe = useCallback(async () => {
    setBusy(true);
    setMeError(null);
    const epoch = session.captureEpoch();
    try {
      const token = await session.getCredential();
      if (!session.isEpochCurrent(epoch)) return;
      if (!token || !epoch) {
        setMe(null);
        setMeError(
          'Không tải được hồ sơ. Đăng nhập lại khi có mạng.',
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
        setMeError(
          result.reason === 'Đã hủy đăng nhập.'
            ? accountCopy.signInCancelHint
            : result.reason,
        );
        return;
      }
      await session.establish(result.accessToken, verifyViaMe);
      const snap = session.getSnapshot();
      if (snap.status !== 'verified') {
        setMeError(
          getApiBaseUrl()
            ? 'Đăng nhập xong nhưng chưa tải được hồ sơ. Thử lại khi có mạng.'
            : 'Đăng nhập xong nhưng bản dựng thiếu địa chỉ API.',
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
      void refreshMe();
      navigateAfterSignIn(presentation);
    } catch (error) {
      setMeError(
        error instanceof Error ? error.message : 'Đăng nhập thất bại.',
      );
    } finally {
      setBusy(false);
    }
  }, [presentation, refreshMe]);

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
      if (staffWorkspace) {
        router.replace('/(tabs)/(events)');
      }
    } catch (error) {
      setMeError(
        error instanceof Error
          ? error.message
          : 'Đăng xuất thất bại khi xóa dữ liệu cục bộ.',
      );
    } finally {
      setBusy(false);
    }
  }, [offline, verifiedUserId, staffWorkspace]);

  const onClearOfflineDisplay = useCallback(async () => {
    setBusy(true);
    try {
      await offlineDisplay.clear();
    } catch (error) {
      setMeError(
        error instanceof Error
          ? error.message
          : 'Không xóa được dữ liệu xem offline.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isSignedIn) {
        void refreshMe();
        return;
      }
      if (!consumePendingImmediateSignIn()) return;
      void onSignIn();
    }, [isSignedIn, onSignIn, refreshMe]),
  );

  const identityKind = isSignedIn ? 'verified' : 'guest';
  const tabBarInset = useAttendeeTabBarInset(24);
  const showLogout = isSignedIn;
  const showDeleteRow = isSignedIn && !meError;

  const youTitle = isSignedIn
    ? visibleMe?.email ?? accountCopy.verified.body
    : accountCopy.guest.title;
  const youBody = isSignedIn
    ? accountCopy.verified.body
    : accountCopy.guest.body;

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{ padding: 20, paddingBottom: tabBarInset, gap: 20 }}
      >
        <AccountGroupedSection title={accountCopy.sections.you}>
          <AccountGroupedRow label={youTitle} value={youBody} disabled={busy} />
          {!isSignedIn ? (
            <>
              <AccountGroupedDivider />
              <AccountGroupedRow
                label={accountCopy.guest.signInCta}
                onPress={() => void onSignIn()}
                disabled={busy}
                testID="account-cta-signin"
              />
            </>
          ) : null}
          {!isSignedIn && offline.status === 'bound' ? (
            <>
              <AccountGroupedDivider />
              <AccountGroupedRow
                label={accountCopy.offlineCache.body}
                disabled={busy}
              />
              <AccountGroupedDivider />
              <AccountGroupedRow
                label={accountCopy.offlineCache.clearRow}
                onPress={() => void onClearOfflineDisplay()}
                disabled={busy}
                destructive
                testID="account-clear-offline"
              />
            </>
          ) : null}
        </AccountGroupedSection>

        <PushAccountSection identityKind={identityKind} disabled={busy} />

        <AccountGroupedSection title={accountCopy.sections.privacy}>
          <AccountGroupedRow
            label={accountCopy.privacyRow}
            showChevron
            onPress={() => router.push('/privacy-policy')}
            disabled={busy}
            testID="account-cta-privacy"
          />
          {showDeleteRow ? (
            <>
              <AccountGroupedDivider />
              <AccountGroupedRow
                label={accountCopy.deleteAccountRow}
                showChevron
                onPress={() =>
                  router.push(
                    staffWorkspace
                      ? `${STAFF_ACCOUNT_HREF}/delete`
                      : '/(tabs)/account/delete',
                  )
                }
                disabled={busy}
                testID="account-delete-row"
              />
            </>
          ) : null}
        </AccountGroupedSection>

        {staffWorkspace ? (
          <AttendeeCta
            label={accountCopy.staffBackToGate}
            variant="secondary"
            onPress={() => router.replace('/(tabs)/staff-scan')}
            disabled={busy}
            testID="account-cta-staff-back"
          />
        ) : null}

        {busy ? (
          <View style={{ padding: 8, alignItems: 'center' }}>
            <ActivityIndicator color={brand.signal} />
            <Text
              style={{
                marginTop: 8,
                color: colors.secondary,
                ...typography.caption,
              }}
              accessibilityLiveRegion="polite"
            >
              {accountCopy.busyLabel}
            </Text>
          </View>
        ) : null}

        {meError ? (
          <View accessibilityLiveRegion="assertive" accessibilityRole="alert">
            <Notice title={accountCopy.meErrorTitle} tone="deny">
              {meError}
            </Notice>
          </View>
        ) : null}

        {showLogout ? (
          <AttendeeCta
            label={accountCopy.logoutCta}
            variant="destructive"
            onPress={() => void onLogout()}
            disabled={busy}
            accessibilityLabel={accountCopy.logoutAccessibility}
            testID="account-cta-logout"
          />
        ) : null}
      </ScrollView>
      {presentation === 'tab' ? (
        <TabStackTitle title={accountCopy.screenTitle} />
      ) : null}
    </>
  );
}
