import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Spinner } from '@/components/ui/spinner';
import { router, useFocusEffect, useSegments } from 'expo-router';
import type { MeResponse } from '@ticket/contracts';
import { AttendeeCta } from '@/components/attendee-cta';
import {
  AccountGroupedDivider,
  AccountGroupedRow,
  AccountGroupedSection
} from '@/components/account-grouped-section';
import { Notice, Page } from '@/components/page';
import { accountCopy } from '@/components/screen-state-copy';
import { brand, colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { getApiBaseUrl, getTenantId, isOidcConfigured } from '@/identity/config';
import { accountMeRefreshFromProbe } from '@/screens/account-me-probe';
import { probeMe, verifyViaMe } from '@/identity/fetch-me';
import {
  endKeycloakSession,
  loginWithKeycloak
} from '@/identity/oidc-login';
import { session } from '@/identity/session';
import {
  bindIfStillVerified,
  captureOfflineBindingEpoch
} from '@/tickets/bind-after-verify';
import { offlineDisplay } from '@/tickets/offline-display-session';
import { logoutAndClearWalletArtifacts } from '@/tickets/wallet-logout';
import { consumePendingImmediateSignIn } from '@/navigation/attendee-auth-gate';
import { consumeSignInReturn } from '@/navigation/sign-in-return-intent';
import { STAFF_ACCOUNT_HREF } from '@/navigation/staff-account-route';
import {
  planPostLogoutNavigation,
  runPostLogoutNavigation
} from '@/navigation/post-logout-navigation';
import { returnToStaffGateScanTab } from '@/navigation/staff-scan-tab-navigation';
import { useStaffWorkspace } from '@/navigation/use-staff-workspace';
import { ATTENDEE_ACCOUNT_HREF } from '@/navigation/attendee-account-route';
import { useAttendeeTabBarInset } from '@/navigation/use-attendee-tab-bar-inset';
import { PushAccountSection } from '@/push/push-account-section';
import { space } from '@/theme/tokens';

export type AccountPresentation = 'tab' | 'stack';

export function AccountScreen({
  presentation = 'tab'
}: {
  presentation?: AccountPresentation;
}) {
  const configured = isOidcConfigured();

  if (!configured) {
    return (
      <>
        <MisconfiguredAccount presentation={presentation} />
      </>
    );
  }

  return <ConfiguredAccount presentation={presentation} />;
}

function MisconfiguredAccount({
  presentation: _presentation
}: {
  presentation: AccountPresentation;
}) {
  return (
    <Page>
      <Notice title={accountCopy.misconfiguredTitle}>
        {accountCopy.misconfiguredBody}
      </Notice>
      <AccountGroupedSection title={accountCopy.sections.privacy}>
        <AccountGroupedRow
          label={accountCopy.privacyRow}
          showChevron
          onPress={() => router.push('/privacy-policy')}
          testID="account-cta-privacy"
        />
      </AccountGroupedSection>
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
  presentation
}: {
  presentation: AccountPresentation;
}) {
  const staffWorkspace = useStaffWorkspace();
  const segments = useSegments();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [logoutFailed, setLogoutFailed] = useState(false);
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
      const probe = await probeMe(token);
      if (!session.isEpochCurrent(epoch)) return;
      const outcome = accountMeRefreshFromProbe(probe, epoch.userId);
      if (outcome.kind === 'error') {
        setMe(null);
        setMeError(outcome.message);
        return;
      }
      setMe(outcome.me);
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
      await session.establish(result.accessToken, verifyViaMe, {
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn
      });
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
          bindingEpoch
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
    const logoutPlan = planPostLogoutNavigation({ segments, staffWorkspace });
    try {
      await logoutAndClearWalletArtifacts({ userId, tenantId });
      setLogoutFailed(false);
      await endKeycloakSession();
      runPostLogoutNavigation(logoutPlan);
    } catch (error) {
      setLogoutFailed(true);
      setMeError(
        error instanceof Error
          ? error.message
          : 'Đăng xuất thất bại khi xóa dữ liệu cục bộ.',
      );
    } finally {
      setBusy(false);
    }
  }, [offline, segments, verifiedUserId, staffWorkspace]);

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

  const tabBarInset = useAttendeeTabBarInset(24);
  const showLogout = isSignedIn;
  const showDeleteRow = isSignedIn && !meError;

  const youTitle = visibleMe?.email ?? accountCopy.verified.body;
  const youBody = accountCopy.verified.body;

  if (!isSignedIn) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{ padding: space.xl, paddingBottom: tabBarInset, gap: space.xl }}
      >
        <AttendeeCta
          label={accountCopy.guest.signInCta}
          onPress={() => void onSignIn()}
          disabled={busy}
          testID="account-cta-signin"
        />
        {meError ? (
          <Notice title={accountCopy.meErrorTitle} tone="deny">
            {meError}
          </Notice>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{ padding: space.xl, paddingBottom: tabBarInset, gap: space.xl }}
      >
        <AccountGroupedSection title={accountCopy.sections.you}>
          <AccountGroupedRow label={youTitle} value={youBody} disabled={busy} />
        </AccountGroupedSection>

        <PushAccountSection identityKind="verified" disabled={busy} />

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
                      : `${ATTENDEE_ACCOUNT_HREF}/delete`,
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
            onPress={() => returnToStaffGateScanTab()}
            disabled={busy}
            testID="account-cta-staff-back"
          />
        ) : null}

        {busy ? (
          <View style={{ padding: space.sm, alignItems: 'center' }}>
            <Spinner color={brand.signal} accessibilityLabel="Đang tải tài khoản" />
            <Text
              style={{
                marginTop: space.sm,
                color: colors.secondary,
                ...typography.caption
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

        {showLogout || logoutFailed ? (
          <AttendeeCta
            label={logoutFailed ? 'Thử lại đăng xuất' : accountCopy.logoutCta}
            variant="destructive"
            onPress={() => void onLogout()}
            disabled={busy}
            accessibilityLabel={logoutFailed ? 'Thử lại dọn dẹp đăng xuất' : accountCopy.logoutAccessibility}
            testID="account-cta-logout"
          />
        ) : null}
      </ScrollView>
    </>
  );
}
