/** Shown when no push provider is configured. Never a delivery receipt. */
export const PUSH_NOT_CONFIGURED = 'Push is not configured';

export type PushNotification = {
  id: string;
  title: string;
  body: string;
};

/** `delivered: true` is not a member. This module does not call APNs. */
export type PushReceipt = {
  readonly delivered: false;
  readonly status: 'not-configured' | 'transport-unavailable';
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

export function pushProviderName(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env.EXPO_PUBLIC_PUSH_PROVIDER?.trim() ?? '';
  return raw.length > 0 ? raw : null;
}

export function pushUiCopy(provider: string | null): {
  title: string;
  body: string;
  announcement: string;
} {
  if (!provider) {
    return {
      title: PUSH_NOT_CONFIGURED,
      body: 'No push provider is configured. Notifications are not delivered.',
      announcement: `${PUSH_NOT_CONFIGURED}. Notifications are not delivered.`,
    };
  }
  return {
    title: 'Push is not delivered',
    body: 'A provider name is set, but this build does not send notifications.',
    announcement: 'Push is not delivered.',
  };
}

/**
 * Fail-closed send. An empty provider returns not-configured and
 * `delivered: false`. A named provider still cannot be delivered: there is
 * no APNs client in this module.
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
  return {
    delivered: false,
    status: 'transport-unavailable',
    message: 'Push transport is not available',
  };
}
