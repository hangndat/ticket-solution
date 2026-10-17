import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Native APNs device-token registration (ADR-12).
 *
 * Uses `getDevicePushTokenAsync` only — never `getExpoPushTokenAsync` /
 * Expo Push Service (`exp.host`). This module does not send notifications
 * and never claims `delivered: true`.
 */

export type ApnsDeviceTokenResult =
  | {
      status: 'ready';
      transport: 'apns';
      /** Opaque APNs device token (hex). Do not log in production paths. */
      token: string;
    }
  | {
      status: 'permission-denied' | 'unavailable' | 'unsupported';
      transport: 'apns';
      reason: string;
    };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permission and read the native APNs device token.
 * Simulator / missing Push capability → `unavailable` (not delivered).
 */
export async function registerApnsDeviceToken(): Promise<ApnsDeviceTokenResult> {
  if (Platform.OS !== 'ios') {
    return {
      status: 'unsupported',
      transport: 'apns',
      reason: 'APNs device tokens are iOS-only in this build.',
    };
  }

  let permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') {
    permissions = await Notifications.requestPermissionsAsync();
  }
  if (permissions.status !== 'granted') {
    return {
      status: 'permission-denied',
      transport: 'apns',
      reason: 'Notification permission was not granted.',
    };
  }

  try {
    const device = await Notifications.getDevicePushTokenAsync();
    const token =
      typeof device.data === 'string'
        ? device.data.trim()
        : String(device.data ?? '').trim();
    if (!token) {
      return {
        status: 'unavailable',
        transport: 'apns',
        reason: 'APNs returned an empty device token.',
      };
    }
    return { status: 'ready', transport: 'apns', token };
  } catch {
    return {
      status: 'unavailable',
      transport: 'apns',
      reason:
        'Native APNs device token is unavailable (simulator, missing Push Notifications capability, or unsigned build).',
    };
  }
}

/** Best-effort local cleanup on logout. Does not call Expo Push SaaS. */
export async function clearApnsRegistrationState(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    /* best-effort */
  }
}
