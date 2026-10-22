import { useCallback, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/page';
import { session } from '@/identity/session';
import {
  currentApnsRegistrationGeneration,
  registerApnsDeviceToken,
  type ApnsDeviceTokenResult,
} from '@/push/apns-device-token';
import {
  isApnsProvider,
  pushProviderName,
  pushUiCopy,
} from '@/push/push';

/** Attendee-facing status — never token hint, length, or APNs operator jargon. */
function summarizeRegistration(result: ApnsDeviceTokenResult): string {
  if (result.status !== 'ready') {
    return 'Chưa bật được thông báo. Kiểm tra quyền thông báo trên thiết bị rồi thử lại.';
  }
  if (result.backend === 'registered') {
    return 'Đã bật thông báo trên thiết bị này.';
  }
  if (result.backend === 'skipped-unsigned') {
    return 'Đăng nhập để lưu thiết bị nhận thông báo.';
  }
  if (result.backend === 'failed') {
    return 'Đã xin quyền trên máy, nhưng chưa lưu lên máy chủ. Thử lại sau.';
  }
  return 'Đã xin quyền thông báo trên thiết bị này.';
}

/** Session key so parents can remount and drop prior-account token UI. */
export function pushSessionKey(
  identity: ReturnType<typeof session.getSnapshot>,
): string {
  return identity.status === 'verified'
    ? `verified:${identity.userId}`
    : identity.status;
}

/** Fail-closed status. Unconfigured builds announce that push is not configured. */
export function PushStatus() {
  const provider = pushProviderName();
  const copy = pushUiCopy(provider);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onRegister = useCallback(() => {
    const gen = currentApnsRegistrationGeneration();
    const epoch = session.captureEpoch();
    setBusy(true);
    setStatusMessage('Đang bật thông báo…');

    let settled = false;
    const finish = (result: ApnsDeviceTokenResult) => {
      if (settled) return;
      settled = true;
      if (currentApnsRegistrationGeneration() !== gen) return;
      if (epoch && !session.isEpochCurrent(epoch)) return;
      if (session.getSnapshot().status === 'signed-out') return;
      setStatusMessage(summarizeRegistration(result));
      setBusy(false);
    };

    // UI watchdog: native callbacks can stall without rejecting the JS promise.
    const watchdog = setTimeout(() => {
      finish({
        status: 'unavailable',
        transport: 'apns',
        reason: 'registration-timeout',
      });
    }, 12_000);

    void registerApnsDeviceToken({ session })
      .then((result) => {
        clearTimeout(watchdog);
        finish(result);
      })
      .catch(() => {
        clearTimeout(watchdog);
        finish({
          status: 'unavailable',
          transport: 'apns',
          reason: 'registration-failed',
        });
      });
  }, []);

  return (
    <View accessibilityLabel={copy.announcement}>
      <Notice title={copy.title}>{copy.body}</Notice>
      {isApnsProvider(provider) ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          <Button
            label={busy ? 'Đang bật…' : 'Bật thông báo'}
            loading={busy}
            accessibilityLabel={
              busy ? 'Đang bật thông báo' : 'Bật thông báo trên thiết bị này'
            }
            testID="register-apns-device-token"
            disabled={busy}
            onPress={() => void onRegister()}
          />
          {statusMessage ? (
            <Notice title="Thông báo">{statusMessage}</Notice>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** PushStatus remounted on identity change so statusMessage cannot survive logout. */
export function SessionScopedPushStatus() {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return <PushStatus key={pushSessionKey(identity)} />;
}
