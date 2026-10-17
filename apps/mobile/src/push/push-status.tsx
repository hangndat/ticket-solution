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

  const onRegister = useCallback(async () => {
    const gen = currentApnsRegistrationGeneration();
    const epoch = session.captureEpoch();
    setBusy(true);
    try {
      const result = await registerApnsDeviceToken({ session });
      if (currentApnsRegistrationGeneration() !== gen) return;
      if (epoch && !session.isEpochCurrent(epoch)) return;
      if (session.getSnapshot().status === 'signed-out') return;
      setTokenSummary(summarizeToken(result));
    } finally {
      if (currentApnsRegistrationGeneration() === gen) {
        setBusy(false);
      }
    }
  }, []);

  return (
    <View accessibilityRole="text" accessibilityLabel={copy.announcement}>
      <Notice title={copy.title}>{copy.body}</Notice>
      {isApnsProvider(provider) ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Register APNs device token"
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
