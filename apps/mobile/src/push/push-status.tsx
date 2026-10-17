import { useCallback, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Notice } from '@/components/page';
import { colors } from '@/theme/colors';
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

function summarizeToken(result: ApnsDeviceTokenResult): string {
  if (result.status !== 'ready') {
    return `${result.status}: ${result.reason}`;
  }
  // Never surface the full device token in UI copy.
  const hint =
    result.token.length > 8
      ? `${result.token.slice(0, 4)}…${result.token.slice(-4)} (${result.token.length} chars)`
      : `(${result.token.length} chars)`;
  const backend =
    result.backend === 'registered'
      ? ' Backend registration saved.'
      : result.backend === 'failed'
        ? ' Backend register failed (token local only).'
        : result.backend === 'skipped-unsigned'
          ? ' Sign in to register with the API.'
          : '';
  return `Native APNs token ready ${hint}.${backend} Not a delivery receipt.`;
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
  const [tokenSummary, setTokenSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onRegister = useCallback(() => {
    const gen = currentApnsRegistrationGeneration();
    const epoch = session.captureEpoch();
    setBusy(true);
    setTokenSummary('Registering native APNs device token…');

    let settled = false;
    const finish = (result: ApnsDeviceTokenResult) => {
      if (settled) return;
      settled = true;
      if (currentApnsRegistrationGeneration() !== gen) return;
      if (epoch && !session.isEpochCurrent(epoch)) return;
      if (session.getSnapshot().status === 'signed-out') return;
      setTokenSummary(summarizeToken(result));
      setBusy(false);
    };

    // UI watchdog: native APNs callbacks can stall under WDA/iOS 26 without
    // rejecting the JS promise; still unblock the Register affordance.
    const watchdog = setTimeout(() => {
      finish({
        status: 'unavailable',
        transport: 'apns',
        reason:
          'APNs device token watchdog timed out (no native callback). Check Push capability / provisioning, then retry.',
      });
    }, 12_000);

    void registerApnsDeviceToken({ session })
      .then((result) => {
        clearTimeout(watchdog);
        finish(result);
      })
      .catch((err: unknown) => {
        clearTimeout(watchdog);
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'APNs device token registration failed unexpectedly.';
        finish({
          status: 'unavailable',
          transport: 'apns',
          reason: message,
        });
      });
  }, []);

  return (
    <View accessibilityLabel={copy.announcement}>
      <Notice title={copy.title}>{copy.body}</Notice>
      {isApnsProvider(provider) ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              busy
                ? 'Registering APNs device token'
                : 'Register APNs device token'
            }
            testID="register-apns-device-token"
            disabled={busy}
            onPress={() => void onRegister()}
            style={({ pressed }) => ({
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: colors.accent,
              opacity: busy ? 0.45 : pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {busy ? 'Registering…' : 'Register APNs device token'}
            </Text>
          </Pressable>
          {tokenSummary ? (
            <Notice title="Device token">{tokenSummary}</Notice>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** PushStatus remounted on identity change so tokenSummary cannot survive logout. */
export function SessionScopedPushStatus() {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return <PushStatus key={pushSessionKey(identity)} />;
}
