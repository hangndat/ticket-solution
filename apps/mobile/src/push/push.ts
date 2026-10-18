/** Shown when no push provider is configured. Never a delivery receipt. */
export const PUSH_NOT_CONFIGURED = 'Chưa cấu hình thông báo';

export type PushNotification = {
  id: string;
  title: string;
  body: string;
};

/** `delivered: true` is not a member. This module does not call APNs HTTP/2. */
export type PushReceipt = {
  readonly delivered: false;
  readonly status: 'not-configured' | 'transport-unavailable' | 'client-only';
  readonly message: string;
};

export class PushDeliveryRefused extends Error {
  readonly delivered = false as const;
  readonly status: PushReceipt['status'];

  constructor(status: PushReceipt['status'], message: string) {
    super(message);
    this.name = 'PushDeliveryRefused';
    this.status = status;
  }
}

/**
 * Runtime fallback for Release/TestFlight when Metro did not inline
 * EXPO_PUBLIC_PUSH_PROVIDER (mirrors identity/config ticketPublic bake).
 */
function readBakedPushProvider(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-constants') as {
      default?: { expoConfig?: { extra?: { ticketPublic?: { pushProvider?: string } } } };
      expoConfig?: { extra?: { ticketPublic?: { pushProvider?: string } } };
    };
    const Constants = mod.default ?? mod;
    const raw = Constants.expoConfig?.extra?.ticketPublic?.pushProvider?.trim() ?? '';
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function pushProviderName(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env.EXPO_PUBLIC_PUSH_PROVIDER?.trim() ?? '';
  if (raw.length > 0) return raw;
  return readBakedPushProvider();
}

export function isApnsProvider(provider: string | null): boolean {
  return (provider ?? '').toLowerCase() === 'apns';
}

export function pushUiCopy(provider: string | null): {
  title: string;
  body: string;
  announcement: string;
} {
  if (!provider) {
    return {
      title: PUSH_NOT_CONFIGURED,
      body: 'Ứng dụng chưa bật kênh thông báo. Bạn sẽ không nhận nhắc trên thiết bị.',
      announcement: `${PUSH_NOT_CONFIGURED}. Không nhận thông báo trên thiết bị.`,
    };
  }
  if (isApnsProvider(provider)) {
    return {
      title: 'Thông báo trên thiết bị',
      body: 'Bạn có thể bật nhận thông báo trên máy này sau khi đăng nhập. Bật thông báo không đồng nghĩa đã gửi tin thành công.',
      announcement:
        'Thông báo trên thiết bị. Chỉ đăng ký nhận tin — chưa phải xác nhận đã gửi.',
    };
  }
  return {
    title: 'Không gửi thông báo',
    body: 'Bản dựng này chưa gửi thông báo tới thiết bị.',
    announcement: 'Không gửi thông báo.',
  };
}

/**
 * Fail-closed send. The mobile app never talks to APNs HTTP/2 or Expo Push.
 * Worker-side delivery is out of this module's ownership.
 */
export function sendPush(
  notification: PushNotification,
  provider: string | null = pushProviderName(),
): PushReceipt {
  void notification;
  return settle(provider, false);
}

/**
 * Rejects a delivered claim. Unconfigured providers throw
 * `PushDeliveryRefused` with `delivered === false` instead of recording success.
 */
export function acceptDeliveredClaim(
  claim: { delivered: boolean },
  provider: string | null = pushProviderName(),
): PushReceipt {
  return settle(provider, claim.delivered);
}

function settle(provider: string | null, delivered: boolean): PushReceipt {
  if (!provider) {
    if (delivered) {
      throw new PushDeliveryRefused('not-configured', PUSH_NOT_CONFIGURED);
    }
    return {
      delivered: false,
      status: 'not-configured',
      message: PUSH_NOT_CONFIGURED,
    };
  }
  if (delivered) {
    throw new PushDeliveryRefused(
      'transport-unavailable',
      'Push transport is not available',
    );
  }
  if (isApnsProvider(provider)) {
    return {
      delivered: false,
      status: 'client-only',
      message:
        'APNs device-token client only; worker delivery is not claimed here',
    };
  }
  return {
    delivered: false,
    status: 'transport-unavailable',
    message: 'Push transport is not available',
  };
}
