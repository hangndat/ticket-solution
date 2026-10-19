import { useCallback, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import {
  AccountGroupedDivider,
  AccountGroupedRow,
  AccountGroupedSection,
  AccountSectionFooter,
} from '@/components/account-grouped-section';
import { accountCopy } from '@/components/screen-state-copy';
import { session } from '@/identity/session';
import {
  derivePushAccountUi,
  type PushBackendRegistration,
} from './push-account-ui.ts';
import type { ApnsDeviceTokenResult } from './apns-device-token.ts';
import {
  readIosNotificationPermission,
  type IosNotificationPermission,
  type PermissionNotificationsLike,
} from './push-permission.ts';
import { isApnsProvider, pushProviderName } from './push.ts';
import { runPushOptIn } from './push-opt-in.ts';

function backendFromResult(
  result: ApnsDeviceTokenResult | null,
  registering: boolean,
): PushBackendRegistration {
  if (registering) return 'registering';
  if (!result || result.status !== 'ready') return 'idle';
  if (result.backend === 'registered') return 'registered';
  if (result.backend === 'failed') return 'failed';
  if (result.backend === 'skipped-unsigned') return 'skipped-unsigned';
  return 'idle';
}

async function loadNotifications(): Promise<PermissionNotificationsLike> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('expo-notifications') as PermissionNotificationsLike & {
    default?: PermissionNotificationsLike;
  };
  return mod.default ?? mod;
}

export function PushAccountSection({
  identityKind,
  disabled,
}: {
  identityKind: 'guest' | 'verified';
  disabled?: boolean;
}) {
  const provider = pushProviderName();
  const [iosPermission, setIosPermission] =
    useState<IosNotificationPermission>('unknown');
  const [backend, setBackend] = useState<PushBackendRegistration>('idle');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<ApnsDeviceTokenResult | null>(
    null,
  );

  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  const refreshPermission = useCallback(async () => {
    if (!isApnsProvider(provider)) return;
    try {
      const notifications = await loadNotifications();
      const perm = await readIosNotificationPermission(notifications);
      setIosPermission(perm);
    } catch {
      setIosPermission('unknown');
    }
  }, [provider]);

  useFocusEffect(
    useCallback(() => {
      void refreshPermission();
    }, [refreshPermission, identity.status]),
  );

  const model = derivePushAccountUi({
    provider,
    identity: identityKind,
    iosPermission,
    backend: backendFromResult(lastResult, busy),
  });

  const onAction = useCallback(async () => {
    if (disabled || busy) return;
    if (model.action.kind === 'sign-in-hint' || model.action.kind === 'none') {
      return;
    }
    setBusy(true);
    if (model.action.kind === 'enable' || model.action.kind === 'retry-server') {
      setBackend('registering');
    }
    try {
      const outcome = await runPushOptIn({ session });
      if (outcome.kind === 'registration') {
        setLastResult(outcome.result);
        if (outcome.result.status === 'ready') {
          if (outcome.result.backend === 'registered') {
            setBackend('registered');
          } else if (outcome.result.backend === 'failed') {
            setBackend('failed');
          } else {
            setBackend('idle');
          }
        } else {
          setBackend('idle');
        }
      }
      await refreshPermission();
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, model.action.kind, refreshPermission]);

  if (!model.sectionVisible) {
    return null;
  }

  const showActionRow =
    model.action.kind === 'enable' ||
    model.action.kind === 'open-settings' ||
    model.action.kind === 'retry-server';

  return (
    <AccountGroupedSection title={accountCopy.sections.notifications}>
      <AccountGroupedRow
        label={model.statusLine}
        value={model.detailLine}
        disabled={disabled || busy}
      />
      {showActionRow && model.actionLabel ? (
        <>
          <AccountGroupedDivider />
          <AccountGroupedRow
            label={busy ? accountCopy.push.busySaving : model.actionLabel}
            onPress={() => void onAction()}
            disabled={disabled || busy}
            testID={
              model.action.kind === 'enable'
                ? 'register-apns-device-token'
                : 'account-push-action'
            }
          />
        </>
      ) : null}
      {busy ? (
        <View style={{ padding: 12, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : null}
      {identityKind === 'guest' ? (
        <AccountSectionFooter>{accountCopy.push.guestHint}</AccountSectionFooter>
      ) : null}
    </AccountGroupedSection>
  );
}
