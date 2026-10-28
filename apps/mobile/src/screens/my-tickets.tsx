import { Link, router, useLocalSearchParams } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore
} from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from 'react-native';
import type { TicketSummary } from '@ticket/contracts';
import { AttendeeCta } from '@/components/attendee-cta';
import { TicketStatusPill } from '@/components/ticket-status-pill';
import { Button } from '@/components/ui/button';
import { EventLogo } from '@/components/event-media';
import { Notice } from '@/components/page';
import {
  EmptyState,
  ErrorState,
  LoadingState
} from '@/components/screen-state';
import { eventsCopy, walletCopy } from '@/components/screen-state-copy';
import { ATTENDEE_REDEEM_PATH } from '@/navigation/attendee-redeem-entry';
import {
  attendeeWalletCopy,
  isUsedTicketState,
  presentTicketRow
} from '@/attendee/attendee-outcome-copy';
import { TicketUsedStamp } from '@/components/ticket-used-stamp';
import { AttendeeScreenChrome } from '@/navigation/attendee-screen-chrome';
import { hasDemoMediaForEventId } from '@/data/demo-media';
import { brand, colors } from '@/theme/colors';
import { space, radius } from '@/theme/tokens';
import { typography } from '@/theme/typography';
import { fontFamilies } from '@/theme/fonts';
import { session } from '@/identity/session';
import {
  currentTicketDisplayWriteEpoch,
  readTicketDisplayCache
} from '@/tickets/display-cache';
import { probeMeTickets } from '@/tickets/fetch-me-tickets';
import { persistWalletTicketCaches } from '@/tickets/wallet-display-persist';
import {
  walletDisplayCacheScope,
  walletFetchScopeFromEnv,
  walletSessionScope
} from '@/tickets/wallet-fetch-scope';
import {
  bindIfStillVerified,
  captureOfflineBindingEpoch
} from '@/tickets/bind-after-verify';
import { offlineDisplay } from '@/tickets/offline-display-session';
import {
  decideCacheHydrate,
  decideTicketSyncApply
} from '@/tickets/ticket-sync-guard';
import { walletOfflineNoticeBody } from '@/tickets/wallet-sync-display';
import { logoutAndClearWalletArtifacts } from '@/tickets/wallet-logout';
import { isApnsProvider, pushProviderName } from '@/push/push';
import { normalizeIosNotificationPermission } from '@/push/push-permission';
import { WalletPushPromptCard } from '@/push/wallet-push-prompt-card';
import { shouldOfferWalletPushPrompt } from '@/push/wallet-push-prompt-policy';
import { readWalletPushPromptDismissed } from '@/push/wallet-push-prompt-store';
import {
  filterTicketsByEventId,
  groupTicketsByEvent,
  resolveWalletFilterEventName,
  walletEventSectionHeader,
  walletTicketCardTitle,
  sortTicketsActiveFirst
} from '@/tickets/wallet-event-grouping';

function parseWalletEventIdFilter(
  raw: string | string[] | undefined,
): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function WalletGroupedTicketList({
  tickets,
  filterEventId
}: {
  tickets: TicketSummary[];
  filterEventId?: string;
}) {
  if (filterEventId) {
    const visible = sortTicketsActiveFirst(
      filterTicketsByEventId(tickets, filterEventId),
    );
    return (
      <View style={{ gap: space.sm }}>
        {visible.map((ticket) => (
          <TicketRow key={ticket.ticketId} ticket={ticket} />
        ))}
      </View>
    );
  }

  const groups = groupTicketsByEvent(tickets);
  return (
    <>
      {groups.map((group) => (
        <View key={group.eventId} style={{ gap: space.sm }}>
          <Text
            accessibilityRole="header"
            style={{ ...typography.sectionTitle, color: brand.ink }}
          >
            {walletEventSectionHeader(group.eventName, group.tickets.length)}
          </Text>
          {group.tickets.map((ticket) => (
            <TicketRow key={ticket.ticketId} ticket={ticket} />
          ))}
        </View>
      ))}
    </>
  );
}

function WalletSlimNotice({ text }: { text: string }) {
  return (
    <View
      accessibilityRole="text"
      style={{
        backgroundColor: colors.surfaceSubtle,
        borderRadius: radius.md,
        paddingVertical: space.sm,
        paddingHorizontal: space.md
      }}
    >
      <Text style={{ ...typography.footnote, color: colors.secondary }}>
        {text}
      </Text>
    </View>
  );
}

function TicketRow({
  ticket,
  showEventTitle = false
}: {
  ticket: TicketSummary;
  /** Event name is shown once by the section header; flat lists repeat it as the title. */
  showEventTitle?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const row = presentTicketRow(ticket);
  const used = isUsedTicketState(ticket.state);
  const title = showEventTitle ? row.eventTitle : walletTicketCardTitle(ticket);
  const hasLogo = hasDemoMediaForEventId(ticket.eventId);
  return (
    <Link
      href={{
        pathname: '/my-tickets/[ticketId]',
        params: { ticketId: ticket.ticketId },
      }}
      asChild
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          used
            ? `${row.eventTitle} · ${attendeeWalletCopy.usedWatermarkA11y}`
            : row.accessibilityLabel
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: 72,
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          backgroundColor: colors.ticketCanvas,
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? colors.focus : colors.line,
          opacity: pressed ? 0.85 : used ? 0.7 : 1,
          overflow: 'hidden',
        })}
      >
        {used ? <TicketUsedStamp /> : null}
        {hasLogo ? (
          <EventLogo
            eventId={ticket.eventId}
            height={32}
            testID={`ticket-logo-${ticket.ticketId}`}
            accessibilityLabel="Logo sự kiện demo trên vé"
          />
        ) : null}
        <View style={{ flex: 1, flexShrink: 1, gap: space.xs }}>
          <Text
            style={{ ...typography.callout, color: brand.ink }}
          >
            {title}
          </Text>
          {row.whenLine ? (
            <Text
              style={{ ...typography.subhead, color: colors.secondary }}
            >
              {row.whenLine}
            </Text>
          ) : null}
        </View>
        {used ? null : <TicketStatusPill label={row.statusLabel} />}
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ ...typography.title, color: colors.secondary }}
        >
          ›
        </Text>
      </Pressable>
    </Link>
  );
}

export function MyTicketsScreen() {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const offline = useSyncExternalStore(
    offlineDisplay.subscribe,
    offlineDisplay.getSnapshot,
    offlineDisplay.getSnapshot,
  );

  if (identity.status === 'verified') {
    return <VerifiedWallet userId={identity.userId} />;
  }

  if (offline.status === 'bound') {
    return (
      <OfflineDisplayWallet
        userId={offline.userId}
        tenantId={offline.tenantId}
      />
    );
  }

  return (
    <>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: brand.paper }}
          contentContainerStyle={{ padding: space.xl }}
        >
          <EmptyState title={walletCopy.guestWalletBlockedTitle}>
            {walletCopy.guestWalletBlockedBody}
          </EmptyState>
        </ScrollView>
      <AttendeeScreenChrome title="Vé của tôi" />
    </>
  );
}

/**
 * Display-only wallet from prior online-verified binding + durable cache.
 * Flat list only: offline cache may lack eventName — no event grouping (issue 602).
 */
function OfflineDisplayWallet({
  userId,
  tenantId
}: {
  userId: string;
  tenantId: string;
}) {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBusy(true);
      try {
        const cache = await readTicketDisplayCache(userId, tenantId);
        if (cancelled) return;
        if (!cache) {
          setTickets([]);
          setSyncedAt(null);
          setError(
            'Có liên kết hiển thị offline nhưng không tìm thấy bộ đệm vé cho tài khoản này.',
          );
          return;
        }
        setTickets(cache.tickets);
        setSyncedAt(cache.syncedAt);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không đọc được bộ đệm hiển thị offline.',
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, tenantId]);

  return (
    <>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: brand.paper }}
      contentContainerStyle={{
        paddingHorizontal: space.xl,
        paddingTop: space.md,
        paddingBottom: space.huge,
        gap: space.xl
      }}
    >
      <WalletSlimNotice
        text={`${attendeeWalletCopy.offlineBannerTitle} · ${walletOfflineNoticeBody(
          attendeeWalletCopy.offlineBannerBody,
          syncedAt,
        )}`}
      />

      {busy && tickets.length === 0 ? (
        <LoadingState title={walletCopy.loading.title}>
          {walletCopy.loading.body}
        </LoadingState>
      ) : null}

      {error ? (
        <ErrorState title={walletCopy.errorTitle}>{error}</ErrorState>
      ) : null}

      {tickets.length === 0 && !busy ? (
        <EmptyState title={walletCopy.emptyOffline.title}>
          {walletCopy.emptyOffline.body}
        </EmptyState>
      ) : (
        <View style={{ gap: space.sm }}>
          {sortTicketsActiveFirst(tickets).map((ticket) => (
            <TicketRow key={ticket.ticketId} ticket={ticket} showEventTitle />
          ))}
        </View>
      )}

    </ScrollView>
    <AttendeeScreenChrome title="Vé của tôi" />
    </>
  );
}

function VerifiedWallet({ userId }: { userId: string }) {
  const { eventId: eventIdParam } = useLocalSearchParams<{ eventId?: string }>();
  const filterEventId = parseWalletEventIdFilter(eventIdParam);
  // Memoize: walletFetchScopeFromEnv() returns a fresh object each call. Putting
  // that object in refresh deps without useMemo re-creates refresh every render
  // and re-fires the mount effect (infinite probeMeTickets / UI flicker) — issue 610.
  const fetchScope = useMemo(() => walletFetchScopeFromEnv(), []);
  const sessionScope = walletSessionScope(fetchScope);
  const cacheScope = walletDisplayCacheScope(fetchScope);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [offline, setOffline] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  const hydrateFromCache = useCallback(async () => {
    const epoch = session.captureEpoch();
    if (!epoch || epoch.userId !== userId) return;
    const cache = await readTicketDisplayCache(userId, cacheScope);
    const decision = decideCacheHydrate({
      epoch,
      isEpochCurrent: (e) => session.isEpochCurrent(e),
      cached: cache,
      expectedUserId: userId
    });
    if (decision.action !== 'apply') return;
    setTickets(decision.tickets);
    setOffline(true);
    setLastSyncedAt(decision.syncedAt);
    if (!session.isEpochCurrent(epoch)) return;
    await session.load(sessionScope, 'me-tickets', async () => decision.tickets);
  }, [cacheScope, sessionScope, userId]);

  const refresh = useCallback(async () => {
    const epoch = session.captureEpoch();
    if (!epoch || epoch.userId !== userId) return;

    setError(null);
    const credential = await session.resolveCredential();
    if (!session.isEpochCurrent(epoch)) return;
    if (credential.status === 'unavailable') {
      setError('Phiên đăng nhập không còn hiệu lực. Đăng nhập lại.');
      return;
    }

    const controller = session.beginRequest();
    // Capture BOTH durable gates before any await so logout cannot be bypassed
    // by bindAfterOnlineVerify defaulting to a post-logout gate.current().
    const writeEpoch = currentTicketDisplayWriteEpoch();
    const bindingEpoch = captureOfflineBindingEpoch();
    const credentialRefreshUnreachable =
      credential.status === 'refresh-unreachable';
    try {
      const probe = credentialRefreshUnreachable
        ? ({ status: 'unreachable' } as const)
        : await probeMeTickets(
            credential.accessToken,
            fetchScope,
            controller.signal,
          );
      if (!session.isEpochCurrent(epoch)) return;

      const cached =
        probe.status === 'ok'
          ? null
          : await readTicketDisplayCache(userId, cacheScope);
      if (!session.isEpochCurrent(epoch)) return;

      const decision = decideTicketSyncApply({
        epoch,
        isEpochCurrent: (e) => session.isEpochCurrent(e),
        probe,
        cached,
        expectedUserId: userId,
        credentialRefreshUnreachable
      });

      if (decision.action === 'stale') return;

      if (decision.action === 'unauthorized') {
        setError(
          'Phiên không còn được phép xem vé. Đăng nhập lại. Không dùng bộ đệm offline.',
        );
        try {
          await logoutAndClearWalletArtifacts({
            userId,
            tenantId: sessionScope,
            walletScope: fetchScope
          });
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Phiên đã hết quyền nhưng dọn dẹp đăng xuất bền vững thất bại.',
          );
        }
        return;
      }

      if (decision.action === 'error') {
        setError(decision.message);
        return;
      }

      if (!session.isEpochCurrent(epoch)) return;
      setTickets(decision.tickets);
      setOffline(decision.offline);
      if (decision.action === 'apply' || decision.action === 'offline-cache') {
        setLastSyncedAt(decision.syncedAt);
      }
      if (decision.action === 'offline-cache') {
        setError(decision.notice);
      } else {
        setError(null);
      }

      if (decision.action === 'apply') {
        if (!session.isEpochCurrent(epoch)) return;
        await persistWalletTicketCaches(
          userId,
          fetchScope,
          decision.tickets,
          decision.syncedAt,
          writeEpoch,
        );
        if (!session.isEpochCurrent(epoch)) return;
        const loaded = await session.load(
          sessionScope,
          'me-tickets',
          async () => decision.tickets,
        );
        if (!loaded || !session.isEpochCurrent(epoch)) return;
        const tenantIds = [
          ...new Set(
            decision.tickets
              .map((row) => row.tenantId?.trim())
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        for (const tenantId of tenantIds) {
          await bindIfStillVerified({
            session,
            offline: offlineDisplay,
            userId,
            tenantId,
            bindingEpoch
          });
        }
      } else if (decision.action === 'offline-cache') {
        if (!session.isEpochCurrent(epoch)) return;
        await session.load(
          sessionScope,
          'me-tickets',
          async () => decision.tickets,
        );
      }
    } finally {
      session.endRequest(controller);
    }
  }, [cacheScope, fetchScope, sessionScope, userId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBusy(true);
      try {
        await hydrateFromCache();
        if (!cancelled) await refresh();
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateFromCache, refresh]);

  useEffect(() => {
    if (tickets.length < 1) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const dismissed = await readWalletPushPromptDismissed();
        const provider = pushProviderName();
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('expo-notifications') as {
          default?: { getPermissionsAsync(): Promise<{ status: string }> };
          getPermissionsAsync(): Promise<{ status: string }>;
        };
        const notifications = mod.default ?? mod;
        const current = await notifications.getPermissionsAsync();
        const perm = normalizeIosNotificationPermission(current.status);
        const offer = shouldOfferWalletPushPrompt({
          ticketCount: tickets.length,
          dismissed,
          providerIsApns: isApnsProvider(provider),
          identityVerified: true,
          iosPermissionAuthorized: perm === 'authorized' || perm === 'provisional'
        });
        if (!cancelled) setShowPushPrompt(offer);
      } catch {
        if (!cancelled) setShowPushPrompt(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tickets.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  return (
    <>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: brand.paper }}
      contentContainerStyle={{
        paddingHorizontal: space.xl,
        paddingTop: space.md,
        paddingBottom: space.huge,
        gap: space.xl
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
      }
    >
      {offline ? (
        <WalletSlimNotice
          text={`${attendeeWalletCopy.offlineBannerTitle} · ${walletOfflineNoticeBody(
            attendeeWalletCopy.offlineBannerBody,
            lastSyncedAt,
          )}`}
        />
      ) : null}

      {filterEventId ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: space.md,
            paddingVertical: space.xs
          }}
        >
          <Text
            style={{ ...typography.subhead, color: brand.ink,
              fontFamily: fontFamilies.bodySemiBold,
              flexShrink: 1 }}
          >
            {resolveWalletFilterEventName(tickets, filterEventId)}
          </Text>
          <Button
            variant="ghost"
            label="Xem tất cả"
            accessibilityLabel="Xem tất cả vé, bỏ lọc sự kiện"
            onPress={() => router.replace('/(tabs)/my-tickets')}
            testID="wallet-clear-event-filter"
          />
        </View>
      ) : null}

      {busy && tickets.length === 0 ? (
        <LoadingState title={walletCopy.loading.title}>
          {walletCopy.loading.body}
        </LoadingState>
      ) : null}

      {showPushPrompt && !offline && tickets.length > 0 ? (
        <WalletPushPromptCard onDismiss={() => setShowPushPrompt(false)} />
      ) : null}

      {error ? (
        <ErrorState
          title={walletCopy.errorTitle}
          onRetry={() => void onRefresh()}
          retryLabel="Làm mới vé"
        >
          {error}
        </ErrorState>
      ) : null}

      {tickets.length === 0 && !busy ? (
        <EmptyState title={walletCopy.emptyOnline.title}>
          {walletCopy.emptyOnline.body}
        </EmptyState>
      ) : (
        <View style={{ gap: space.xl }}>
          <WalletGroupedTicketList
            tickets={tickets}
            filterEventId={filterEventId}
          />
        </View>
      )}

      {tickets.length === 0 && !busy ? (
        <AttendeeCta
          label={eventsCopy.redeemCta}
          variant="secondary"
          onPress={() => router.push(ATTENDEE_REDEEM_PATH)}
        />
      ) : null}
    </ScrollView>
    <AttendeeScreenChrome title="Vé của tôi" />
    </>
  );
}
