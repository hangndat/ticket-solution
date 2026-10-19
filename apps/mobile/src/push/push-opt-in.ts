import { Linking } from 'react-native';
import type { SessionBoundary } from '@/identity/session-boundary';
import {
  registerApnsDeviceToken,
  type ApnsDeviceTokenResult,
  type ApnsNotificationsLike,
} from './apns-device-token.ts';
import {
  normalizeIosNotificationPermission,
  readIosNotificationPermission,
  requestIosNotificationPermissionIfNeeded,
  type IosNotificationPermission,
} from './push-permission.ts';

export type PushOptInOutcome =
  | { kind: 'permission-denied'; permission: IosNotificationPermission }
  | { kind: 'permission-open-settings' }
  | { kind: 'registration'; result: ApnsDeviceTokenResult };

export type PushOptInDeps = {
  session?: SessionBoundary;
  notifications?: ApnsNotificationsLike;
};

/**
 * Account / wallet opt-in: system prompt when notDetermined; Settings when denied;
 * then APNs device-token POST when authorized.
 */
export async function runPushOptIn(
  deps: PushOptInDeps = {},
): Promise<PushOptInOutcome> {
  const notifications =
    deps.notifications ??
    (await (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('expo-notifications') as ApnsNotificationsLike & {
        default?: ApnsNotificationsLike;
      };
      return mod.default ?? mod;
    })());

  const before = await readIosNotificationPermission(notifications);
  if (before === 'denied') {
    try {
      await Linking.openSettings();
    } catch {
      /* user can open Settings manually */
    }
    return { kind: 'permission-open-settings' };
  }

  const after = await requestIosNotificationPermissionIfNeeded(notifications);
  const normalized = normalizeIosNotificationPermission(
    after === 'unknown' ? 'denied' : after,
  );
  if (normalized === 'denied') {
    return { kind: 'permission-denied', permission: normalized };
  }
  if (normalized !== 'authorized' && normalized !== 'provisional') {
    return { kind: 'permission-denied', permission: normalized };
  }

  const result = await registerApnsDeviceToken({
    session: deps.session,
    notifications,
  });
  return { kind: 'registration', result };
}
