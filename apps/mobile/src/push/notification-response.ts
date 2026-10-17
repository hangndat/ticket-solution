import {
  DEFAULT_NOTIFICATION_ACTION,
  type NotificationKind,
} from './notification-contract.ts';
import {
  beginResponseResolve,
  endResponseResolve,
  markResponseConsumed,
  parkNotificationTapIntent,
  wasResponseConsumed,
} from './notification-intent.ts';
import {
  notificationResponseId,
  parsePushNotificationData,
} from './notification-payload.ts';
import {
  resolveNotificationRoute,
  type NotificationResolveDeps,
  type NotificationRouteTarget,
} from './notification-resolve.ts';

/**
 * Minimal notification response shape — matches expo-notifications enough for
 * cold/warm handling without importing native modules in unit tests.
 */
export type NotificationResponseLike = {
  actionIdentifier: string;
  notification: {
    date: number;
    request: {
      identifier: string;
      content: {
        data?: Record<string, unknown>;
      };
    };
  };
};

export type NotificationResponseSubscription = {
  remove(): void;
};

/** Explicit test-only / injectable transport — never a production fixture. */
export type NotificationResponseTransport = {
  getLastNotificationResponseAsync(): Promise<NotificationResponseLike | null>;
  addNotificationResponseReceivedListener(
    listener: (response: NotificationResponseLike) => void,
  ): NotificationResponseSubscription;
  clearLastNotificationResponseAsync?: () => Promise<void>;
};

export type NotificationNavigate = (href: string) => void;

export type HandleNotificationResponseResult =
  | { status: 'navigated'; href: string; target: NotificationRouteTarget }
  | { status: 'parked'; kind: NotificationKind }
  | {
      status:
        | 'ignored'
        | 'duplicate'
        | 'invalid'
        | 'denied'
        | 'unsigned-parked'
        | 'stale'
        | 'unreachable'
        | 'misconfigured';
      reason?: string;
    };

export type HandleNotificationResponseDeps = NotificationResolveDeps & {
  navigate: NotificationNavigate;
  /** When true, unsigned taps park for login-return. Default true. */
  parkWhenUnsigned?: boolean;
  defaultActionIdentifier?: string;
};

function extractData(
  response: NotificationResponseLike,
): unknown {
  return response.notification.request.content.data;
}

/**
 * Consume one notification response: validate → dedupe → park or resolve →
 * navigate once. Safe for cold (last response) and warm (listener) paths.
 */
export async function handleNotificationResponse(
  response: NotificationResponseLike,
  deps: HandleNotificationResponseDeps,
): Promise<HandleNotificationResponseResult> {
  const defaultAction =
    deps.defaultActionIdentifier ?? DEFAULT_NOTIFICATION_ACTION;
  if (response.actionIdentifier !== defaultAction) {
    return { status: 'ignored', reason: 'non-default-action' };
  }

  const responseId = notificationResponseId({
    identifier: response.notification.request.identifier,
    date: response.notification.date,
    actionIdentifier: response.actionIdentifier,
  });

  if (wasResponseConsumed(responseId)) {
    return { status: 'duplicate' };
  }
  if (!beginResponseResolve(responseId)) {
    return { status: 'duplicate' };
  }

  try {
    const parsed = parsePushNotificationData(extractData(response));
    if (!parsed.ok) {
      markResponseConsumed(responseId);
      return { status: 'invalid', reason: parsed.reason };
    }

    const epoch = deps.session.captureEpoch();
    if (!epoch) {
      const parkWhenUnsigned = deps.parkWhenUnsigned !== false;
      if (!parkWhenUnsigned) {
        markResponseConsumed(responseId);
        return { status: 'denied', reason: 'unsigned' };
      }
      parkNotificationTapIntent({
        responseId,
        kind: parsed.kind,
        payloadVersion: parsed.payloadVersion,
        ticketId: parsed.ticketId,
        eventId: parsed.eventId,
        tenantId: parsed.tenantId,
        tenantSlug: parsed.tenantSlug,
        eventSlug: parsed.eventSlug,
        parkedUserId: null,
        parkedGeneration: null,
      });
      return { status: 'parked', kind: parsed.kind };
    }

    parkNotificationTapIntent({
      responseId,
      kind: parsed.kind,
      payloadVersion: parsed.payloadVersion,
      ticketId: parsed.ticketId,
      eventId: parsed.eventId,
      tenantId: parsed.tenantId,
      tenantSlug: parsed.tenantSlug,
      eventSlug: parsed.eventSlug,
      parkedUserId: epoch.userId,
      parkedGeneration: epoch.generation,
    });

    const resolved = await resolveNotificationRoute(
      {
        kind: parsed.kind,
        ticketId: parsed.ticketId,
        eventId: parsed.eventId,
        tenantId: parsed.tenantId,
        tenantSlug: parsed.tenantSlug,
        eventSlug: parsed.eventSlug,
      },
      deps,
    );

    if (!deps.session.isEpochCurrent(epoch)) {
      // Account switch / logout during resolve — do not navigate prior data.
      return { status: 'stale' };
    }

    if (resolved.status === 'unsigned') {
      return { status: 'parked', kind: parsed.kind };
    }
    if (resolved.status === 'epoch-stale') {
      return { status: 'stale' };
    }
    if (
      resolved.status === 'unauthorized' ||
      resolved.status === 'not-found'
    ) {
      markResponseConsumed(responseId);
      return { status: 'denied', reason: resolved.status };
    }
    if (resolved.status === 'unreachable') {
      return { status: 'unreachable' };
    }
    if (resolved.status === 'misconfigured') {
      return { status: 'misconfigured' };
    }
    if (resolved.status !== 'routed') {
      markResponseConsumed(responseId);
      return { status: 'invalid', reason: resolved.status };
    }

    markResponseConsumed(responseId);
    deps.navigate(resolved.target.href);
    return {
      status: 'navigated',
      href: resolved.target.href,
      target: resolved.target,
    };
  } finally {
    endResponseResolve(responseId);
  }
}

export type NotificationResponseController = {
  stop(): void;
  /** Process last cold-start response if any. */
  consumeLast(): Promise<HandleNotificationResponseResult | null>;
};

/**
 * Wire cold (`getLastNotificationResponseAsync`) + warm listener.
 * Transport must be injected in unit tests; production loads expo-notifications.
 */
export function startNotificationResponseHandling(
  transport: NotificationResponseTransport,
  deps: HandleNotificationResponseDeps,
): NotificationResponseController {
  let stopped = false;

  const onResponse = (response: NotificationResponseLike) => {
    if (stopped) return;
    void handleNotificationResponse(response, deps).then(async (result) => {
      if (
        result.status === 'navigated' ||
        result.status === 'invalid' ||
        result.status === 'denied' ||
        result.status === 'duplicate'
      ) {
        try {
          await transport.clearLastNotificationResponseAsync?.();
        } catch {
          /* best-effort */
        }
      }
    });
  };

  const subscription =
    transport.addNotificationResponseReceivedListener(onResponse);

  return {
    stop() {
      stopped = true;
      subscription.remove();
    },
    async consumeLast() {
      if (stopped) return null;
      let last: NotificationResponseLike | null = null;
      try {
        last = await transport.getLastNotificationResponseAsync();
      } catch {
        return null;
      }
      if (!last || stopped) return null;
      const result = await handleNotificationResponse(last, deps);
      if (
        result.status === 'navigated' ||
        result.status === 'invalid' ||
        result.status === 'denied' ||
        result.status === 'duplicate'
      ) {
        try {
          await transport.clearLastNotificationResponseAsync?.();
        } catch {
          /* best-effort */
        }
      }
      return result;
    },
  };
}

/** Lazy production transport — keeps native import out of unit tests. */
export async function createExpoNotificationResponseTransport(): Promise<NotificationResponseTransport> {
  const Notifications = await import('expo-notifications');
  return {
    getLastNotificationResponseAsync: async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      return (last as NotificationResponseLike | null) ?? null;
    },
    addNotificationResponseReceivedListener: (listener) => {
      const sub = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          listener(response as NotificationResponseLike);
        },
      );
      return { remove: () => sub.remove() };
    },
    clearLastNotificationResponseAsync: () =>
      Notifications.clearLastNotificationResponseAsync(),
  };
}
