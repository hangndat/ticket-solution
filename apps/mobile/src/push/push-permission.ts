/**
 * iOS notification permission (alert) — separate from APNs device-token minting.
 * PD Account §3: UI reads getPermissionsAsync; opt-in calls requestPermissionsAsync once.
 */

export type IosNotificationPermission =
  | 'not-determined'
  | 'denied'
  | 'authorized'
  | 'provisional'
  | 'unknown';

export function normalizeIosNotificationPermission(
  status: string | undefined,
): IosNotificationPermission {
  switch ((status ?? '').toLowerCase()) {
    case 'undetermined':
    case 'notdetermined':
      return 'not-determined';
    case 'denied':
      return 'denied';
    case 'granted':
    case 'authorized':
      return 'authorized';
    case 'provisional':
      return 'provisional';
    default:
      return 'unknown';
  }
}

export type PermissionNotificationsLike = {
  getPermissionsAsync(): Promise<{ status: string }>;
  requestPermissionsAsync(permissions?: unknown): Promise<{ status: string }>;
};

export async function readIosNotificationPermission(
  notifications: PermissionNotificationsLike,
): Promise<IosNotificationPermission> {
  const current = await notifications.getPermissionsAsync();
  return normalizeIosNotificationPermission(current.status);
}

/**
 * Request system permission when still not determined. Never calls request when denied.
 */
export async function requestIosNotificationPermissionIfNeeded(
  notifications: PermissionNotificationsLike,
): Promise<IosNotificationPermission> {
  const before = await readIosNotificationPermission(notifications);
  if (before === 'denied' || before === 'authorized' || before === 'provisional') {
    return before;
  }
  if (before !== 'not-determined') {
    return before;
  }
  const result = await notifications.requestPermissionsAsync();
  return normalizeIosNotificationPermission(result.status);
}
