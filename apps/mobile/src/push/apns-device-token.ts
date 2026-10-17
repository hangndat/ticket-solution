import type { SessionBoundary } from '../identity/session-boundary.ts';
import {
  deleteDeviceToken,
  postDeviceToken,
} from './device-token-api.ts';
import {
  secureApnsRegistrationStore,
  type ApnsRegistrationStore,
} from './apns-registration-store.ts';
import type {
  DeviceTokenEnvironment,
  DeviceTokenRegistration,
} from './device-token-types.ts';

/**
 * Native APNs device-token registration (ADR-12) + POST/DELETE
 * `/v1/me/device-tokens` when SessionBoundary is verified.
 *
 * Uses `getDevicePushTokenAsync` only — never `getExpoPushTokenAsync` /
 * Expo Push Service (`exp.host`). Never claims `delivered: true`.
 *
 * Expo Notifications / React Native are loaded lazily so unit tests can inject
 * fakes without importing native modules under node:test.
 */

export type ApnsDeviceTokenResult =
  | {
      status: 'ready';
      transport: 'apns';
      /** Opaque APNs device token (hex). Do not log in production paths. */
      token: string;
      /** Present when POST /v1/me/device-tokens succeeded under a live epoch. */
      registration?: DeviceTokenRegistration;
      backend?: 'registered' | 'skipped-unsigned' | 'failed';
    }
  | {
      status: 'permission-denied' | 'unavailable' | 'unsupported' | 'cancelled';
      transport: 'apns';
      reason: string;
    };

/** Bumped on every detach/clear so late register callbacks cannot resurrect UI/state. */
let registrationGeneration = 0;

export function currentApnsRegistrationGeneration(): number {
  return registrationGeneration;
}

/** Test helper — reset generation between cases. */
export function __resetApnsRegistrationGenerationForTests(): void {
  registrationGeneration = 0;
}

/**
 * Maps build entitlement / env to the API `environment` field.
 * `aps-environment=development` → sandbox; production entitlement → production.
 */
export function resolveApnsApiEnvironment(
  env: Record<string, string | undefined> = process.env,
): DeviceTokenEnvironment {
  const raw =
    env.EXPO_PUBLIC_APS_ENVIRONMENT?.trim() ||
    env.APS_ENVIRONMENT?.trim() ||
    env.APP_VARIANT?.trim() ||
    '';
  if (raw === 'production') return 'production';
  return 'sandbox';
}

export type ApnsNotificationsLike = {
  getPermissionsAsync(): Promise<{ status: string }>;
  requestPermissionsAsync(): Promise<{ status: string }>;
  getDevicePushTokenAsync(): Promise<{ data: unknown }>;
  setBadgeCountAsync(count: number): Promise<unknown>;
};

export type RegisterApnsDeps = {
  session?: SessionBoundary;
  store?: ApnsRegistrationStore;
  notifications?: ApnsNotificationsLike;
  fetchImpl?: typeof fetch;
  platform?: string;
  resolveEnvironment?: () => DeviceTokenEnvironment;
};

export type ClearApnsDeps = {
  /** Prefer calling while SessionBoundary is still verified (before logout). */
  session?: SessionBoundary;
  store?: ApnsRegistrationStore;
  notifications?: ApnsNotificationsLike;
  fetchImpl?: typeof fetch;
  /** Optional bearer captured before logout if session already signed out. */
  bearer?: string | null;
};

async function defaultNotifications(): Promise<ApnsNotificationsLike> {
  const Notifications = await import('expo-notifications');
  return Notifications;
}

async function defaultPlatform(): Promise<string> {
  const { Platform } = await import('react-native');
  return Platform.OS;
}

async function defaultBoundary(): Promise<SessionBoundary> {
  const { session } = await import('../identity/session.ts');
  return session;
}

/**
 * Request notification permission, read the native APNs device token, and
 * when SessionBoundary is verified POST `/v1/me/device-tokens` under epoch +
 * AbortController guards so logout/account-switch cannot attach a stale token.
 */
export async function registerApnsDeviceToken(
  deps: RegisterApnsDeps = {},
): Promise<ApnsDeviceTokenResult> {
  const platform = deps.platform ?? (await defaultPlatform());
  const notifications = deps.notifications ?? (await defaultNotifications());
  const boundary = deps.session ?? (await defaultBoundary());
  const store = deps.store ?? secureApnsRegistrationStore;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const resolveEnvironment =
    deps.resolveEnvironment ?? (() => resolveApnsApiEnvironment());

  if (platform !== 'ios') {
    return {
      status: 'unsupported',
      transport: 'apns',
      reason: 'APNs device tokens are iOS-only in this build.',
    };
  }

  const genAtStart = registrationGeneration;
  const epoch = boundary.captureEpoch();

  let permissions = await notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') {
    permissions = await notifications.requestPermissionsAsync();
  }
  if (registrationGeneration !== genAtStart) {
    return {
      status: 'cancelled',
      transport: 'apns',
      reason: 'Registration cancelled after logout or account switch.',
    };
  }
  if (permissions.status !== 'granted') {
    return {
      status: 'permission-denied',
      transport: 'apns',
      reason: 'Notification permission was not granted.',
    };
  }

  let token: string;
  try {
    const device = await notifications.getDevicePushTokenAsync();
    token =
      typeof device.data === 'string'
        ? device.data.trim()
        : String(device.data ?? '').trim();
  } catch {
    return {
      status: 'unavailable',
      transport: 'apns',
      reason:
        'Native APNs device token is unavailable (simulator, missing Push Notifications capability, or unsigned build).',
    };
  }

  if (registrationGeneration !== genAtStart) {
    return {
      status: 'cancelled',
      transport: 'apns',
      reason: 'Registration cancelled after logout or account switch.',
    };
  }
  if (!token) {
    return {
      status: 'unavailable',
      transport: 'apns',
      reason: 'APNs returned an empty device token.',
    };
  }

  // Native token ready — backend wire only while the same verified epoch is live.
  if (!epoch || !boundary.isEpochCurrent(epoch)) {
    return {
      status: 'ready',
      transport: 'apns',
      token,
      backend: 'skipped-unsigned',
    };
  }

  const bearer = await boundary.getCredential();
  if (
    registrationGeneration !== genAtStart ||
    !boundary.isEpochCurrent(epoch) ||
    !bearer
  ) {
    return {
      status: 'cancelled',
      transport: 'apns',
      reason: 'Session ended before device-token POST.',
    };
  }

  const controller = boundary.beginRequest();
  try {
    const posted = await postDeviceToken(
      bearer,
      { token, environment: resolveEnvironment() },
      controller.signal,
      fetchImpl,
    );
    const staleAfterPost =
      registrationGeneration !== genAtStart ||
      !boundary.isEpochCurrent(epoch);
    if (staleAfterPost) {
      // POST may have succeeded after clearApns bumped generation (beginRequest
      // is not aborted by clear). Compensate so the old account cannot keep the
      // device token on the server (TD §413 / PRD M09).
      if (posted.status === 'ok') {
        await compensateOrphanServerRegistration({
          bearer,
          registrationId: posted.registration.registrationId,
          store,
          fetchImpl,
        });
      }
      return {
        status: 'cancelled',
        transport: 'apns',
        reason: 'Session ended during device-token POST.',
      };
    }
    if (posted.status !== 'ok') {
      return {
        status: 'ready',
        transport: 'apns',
        token,
        backend: 'failed',
      };
    }
    await store.write({
      registrationId: posted.registration.registrationId,
      environment: posted.registration.environment,
      userId: epoch.userId,
    });
    if (
      registrationGeneration !== genAtStart ||
      !boundary.isEpochCurrent(epoch)
    ) {
      await compensateOrphanServerRegistration({
        bearer,
        registrationId: posted.registration.registrationId,
        store,
        fetchImpl,
      });
      return {
        status: 'cancelled',
        transport: 'apns',
        reason: 'Session ended after device-token POST.',
      };
    }
    return {
      status: 'ready',
      transport: 'apns',
      token,
      registration: posted.registration,
      backend: 'registered',
    };
  } finally {
    boundary.endRequest(controller);
  }
}

/**
 * Best-effort DELETE + local clear when a registration landed on the server
 * after detach/account-switch invalidated the client generation/epoch.
 * Uses the bearer captured for the original POST (may still be valid before logout).
 */
async function compensateOrphanServerRegistration(input: {
  bearer: string;
  registrationId: string;
  store: ApnsRegistrationStore;
  fetchImpl: typeof fetch;
}): Promise<void> {
  try {
    await deleteDeviceToken(
      input.bearer,
      input.registrationId,
      undefined,
      input.fetchImpl,
    );
  } catch {
    /* best-effort — cannot prove server revoke if DELETE fails */
  }
  try {
    await input.store.clear();
  } catch {
    /* best-effort */
  }
}

/**
 * Detach push registration for logout / account-switch:
 * 1) Bump generation (cancel in-flight register)
 * 2) Best-effort DELETE `/v1/me/device-tokens/{id}` while bearer still available
 * 3) Clear local registration SecureStore
 * 4) Clear badge
 *
 * Call **before** `session.logout()` so the bearer is still readable.
 */
export async function clearApnsRegistrationState(
  deps: ClearApnsDeps = {},
): Promise<void> {
  registrationGeneration += 1;
  const boundary = deps.session ?? (await defaultBoundary());
  const store = deps.store ?? secureApnsRegistrationStore;
  const notifications = deps.notifications ?? (await defaultNotifications());
  const fetchImpl = deps.fetchImpl ?? fetch;

  let local: Awaited<ReturnType<ApnsRegistrationStore['read']>> = null;
  try {
    local = await store.read();
  } catch {
    local = null;
  }

  const bearer =
    deps.bearer !== undefined
      ? deps.bearer
      : await boundary.getCredential().catch(() => null);

  if (local?.registrationId && bearer) {
    try {
      await deleteDeviceToken(bearer, local.registrationId, undefined, fetchImpl);
    } catch {
      /* best-effort detach — logout must continue */
    }
  }

  try {
    await store.clear();
  } catch {
    /* best-effort */
  }

  try {
    await notifications.setBadgeCountAsync(0);
  } catch {
    /* best-effort */
  }
}
