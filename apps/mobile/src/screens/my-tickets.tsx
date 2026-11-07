import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { Button } from '@/components/ui/button';
import { EVENT_BANNER_HEIGHT_TICKET } from '@/components/event-banner-metrics';
import { EventBanner } from '@/components/event-media';
import {
  EmptyState,
  ErrorState,
  LoadingState
} from '@/components/screen-state';
import { walletCopy } from '@/components/screen-state-copy';
import { ATTENDEE_REDEEM_PATH } from '@/navigation/attendee-redeem-entry';
import { ATTENDEE_ACCOUNT_HREF, GUEST_HOME_HREF } from '@/navigation/attendee-account-route';
import {
  attendeeWalletCopy
} from '@/attendee/attendee-outcome-copy';
import { AttendeeScreenChrome } from '@/navigation/attendee-screen-chrome';
import { brand, colors } from '@/theme/colors';
import { elevation, layout, space, radius } from '@/theme/tokens';
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
import { formatWalletEventStart, selectHeroTicket } from '@/tickets/wallet-hero-ticket';
import { startWalletFocusRefresh } from '@/tickets/wallet-focus-refresh';
import { walletContentPhase } from '@/tickets/wallet-content-phase';
import { logoutAndClearWalletArtifacts } from '@/tickets/wallet-logout';
import { isApnsProvider, pushProviderName } from '@/push/push';
import { normalizeIosNotificationPermission } from '@/push/push-permission';
import { WalletPushPromptCard } from '@/push/wallet-push-prompt-card';
import { shouldOfferWalletPushPrompt } from '@/push/wallet-push-prompt-policy';
import { readWalletPushPromptDismissed } from '@/push/wallet-push-prompt-store';
import {
  eventIdentityColor,
  eventInitial,
  filterTicketsByEventId,
  groupTicketsByEvent,
  resolveWalletFilterEventName,
  walletGroupA11yLabel,
  walletGroupCountChip,
  walletGroupSummary,
  walletTicketA11yLabel,
  walletTicketCardTitle,
  walletTicketStatus,
  countDistinctEvents,
  ticketEventDisplayName,
  filterWalletTickets,
  groupWalletTicketsByDate,
  walletListSubtitle,
  type WalletFilter,
  type EventTicketGroup,
  type WalletTicketStatus
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
  filterEventId,
  offline = false
}: {
  tickets: TicketSummary[];
  filterEventId?: string;
  offline?: boolean;
}) {
  const groups = groupTicketsByEvent(
    filterEventId ? filterTicketsByEventId(tickets, filterEventId) : tickets,
  );
  return (
    <>
      {groups.map((group) => (
        <EventTicketSection key={group.eventId} group={group} offline={offline} />
      ))}
    </>
  );
}

const walletEyebrowStyle = {
  ...typography.badge,
  color: colors.secondary,
  textTransform: 'uppercase' as const
};

/** Hero card: most urgent usable ticket, surfaced above the compact remaining list (A+C). */
function WalletHeroTicket({
  ticket,
  group,
  offline
}: {
  ticket: TicketSummary;
  group: EventTicketGroup;
  offline: boolean;
}) {
  const status = walletTicketStatus(ticket, { offline });
  const eventStart = formatWalletEventStart(ticket.startsAt);
  return (
    <View
      style={{
        backgroundColor: colors.ticketCanvas,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.line,
        overflow: 'hidden',
        ...elevation.card
      }}
    >
      <EventBanner
        eventId={group.eventId}
        fallbackColor={group.brandColor}
        allowDemoMedia={false}
        height={EVENT_BANNER_HEIGHT_TICKET}
        style={{ borderRadius: layout.none }}
        testID="wallet-hero-banner"
        accessibilityLabel="Hình nhận diện sự kiện"
      />
      <View style={{ padding: space.lg, gap: space.sm }}>
        <StatusChip status={status} />
        <Text style={{ ...typography.title, color: brand.ink }}>
          {group.eventName}
        </Text>
        {eventStart ? (
          <Text style={{ ...typography.footnote, color: colors.secondary }}>
            {`Ngày sự kiện · ${eventStart} (giờ thiết bị)`}
          </Text>
        ) : null}
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <Text style={{ ...typography.footnoteSemibold, color: brand.ink }}>
          {walletTicketCardTitle(ticket)}
        </Text>
        <Button
          label={attendeeWalletCopy.viewTicketCta}
          variant="primary"
          size="lg"
          accessibilityLabel={walletTicketA11yLabel(group.eventName, ticket, status)}
          onPress={() =>
            router.push({
              pathname: '/my-tickets/[ticketId]',
              params: { ticketId: ticket.ticketId },
            })
          }
          testID="wallet-hero-cta"
        />
      </View>
    </View>
  );
}

/** Event identity block: banner image when the event has one, else its color + initial. */
function EventIdentityBlock({ group }: { group: EventTicketGroup }) {
  const size = 56;
  const color = eventIdentityColor(group.eventId, group.brandColor);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Text
        style={{
          ...typography.avatarInitial,
          color: colors.onAccent
        }}
      >
        {eventInitial(group.eventName)}
      </Text>
    </View>
  );
}

function EventTicketSection({
  group,
  offline
}: {
  group: EventTicketGroup;
  offline: boolean;
}) {
  const accent = eventIdentityColor(group.eventId, group.brandColor);
  const summary = walletGroupSummary(group);
  return (
    <View style={{ gap: space.sm }}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={walletGroupA11yLabel(group)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
      >
        <EventIdentityBlock group={group} />
        <View style={{ flex: 1, flexShrink: 1, gap: space.xxs }}>
          <Text style={{ ...typography.callout, color: brand.ink }}>
            {group.eventName}
          </Text>
          {group.metaLine ? (
            <Text style={{ ...typography.caption, color: colors.secondary }}>
              {group.metaLine}
            </Text>
          ) : null}
          {summary ? (
            <Text style={{ ...typography.caption, color: colors.secondary }}>
              {summary}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radius.sm,
            paddingHorizontal: space.sm,
            paddingVertical: space.xs
          }}
        >
          <Text style={{ ...typography.badge, color: brand.ink }}>
            {walletGroupCountChip(group.tickets.length)}
          </Text>
        </View>
      </View>
      {group.tickets.map((ticket) => (
        <TicketRow
          key={ticket.ticketId}
          ticket={ticket}
          eventName={group.eventName}
          accent={accent}
          offline={offline}
        />
      ))}
    </View>
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

function StatusChip({ status }: { status: WalletTicketStatus }) {
  const palette = {
    usable: { bg: colors.admitSurface, fg: colors.admit },
    sync: { bg: colors.unknownSurface, fg: colors.unknown },
    used: { bg: colors.surfaceMuted, fg: colors.secondary },
    inactive: { bg: colors.surfaceMuted, fg: colors.secondary },
    pending: { bg: colors.surfaceSubtle, fg: colors.secondary }
  }[status.tone];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        alignSelf: 'flex-start',
        backgroundColor: palette.bg,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs
      }}
    >
      {status.tone === 'used' ? (
        <Text style={{ ...typography.badge, color: palette.fg }}>✓</Text>
      ) : null}
      <Text
        style={{
          ...typography.badge,
          color: palette.fg,
          fontFamily: fontFamilies.bodySemiBold
        }}
      >
        {status.label}
      </Text>
    </View>
  );
}

function TicketRow({
  ticket,
  eventName,
  accent,
  offline = false
}: {
  ticket: TicketSummary;
  eventName: string;
  accent: string;
  offline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const status = walletTicketStatus(ticket, { offline });
  const quiet = status.tone === 'used' || status.tone === 'inactive';
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
        accessibilityLabel={walletTicketA11yLabel(eventName, ticket, status)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: 56,
          paddingVertical: space.sm,
          paddingHorizontal: space.md,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: quiet ? colors.surfaceSubtle : colors.ticketCanvas,
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? colors.focus : colors.line,
          borderLeftWidth: 4,
          borderLeftColor: focused ? colors.focus : accent,
          opacity: pressed ? 0.85 : 1,
          overflow: 'hidden',
        })}
      >
        <Text
          style={{
            ...typography.callout,
            flex: 1,
            flexShrink: 1,
            color: quiet ? colors.secondary : brand.ink
          }}
        >
          {walletTicketCardTitle(ticket)}
        </Text>
        <StatusChip status={status} />
      </Pressable>
    </Link>
  );
}

function WalletFilterBar({
  value,
  onChange
}: {
  value: WalletFilter;
  onChange: (next: WalletFilter) => void;
}) {
  const items: Array<{ key: WalletFilter; label: string }> = [
    { key: 'upcoming', label: 'Sắp dùng' },
    { key: 'all', label: 'Tất cả' },
    { key: 'past', label: 'Đã qua' }
  ];
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: space.xs, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: space.xs }}>
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(item.key)}
            style={{ flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.xs, borderRadius: radius.sm, backgroundColor: selected ? colors.ticketCanvas : 'transparent' }}
            testID={`wallet-filter-${item.key}`}
          >
            <Text style={{ ...typography.footnoteSemibold, color: selected ? brand.primary : colors.secondary, textAlign: 'center' }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function WalletDateTimeline({
  tickets,
  offline
}: {
  tickets: TicketSummary[];
  offline: boolean;
}) {
  const sections = groupWalletTicketsByDate(tickets);
  return (
    <View style={{ gap: space.md }}>
      {sections.map((section) => (
        <View key={section.key} style={{ gap: space.xs }}>
          <Text accessibilityRole="header" style={{ ...typography.footnoteSemibold, color: colors.secondary, textTransform: 'capitalize' }}>{section.label}</Text>
          {section.tickets.map((ticket) => {
            const status = walletTicketStatus(ticket, { offline });
            const time = formatWalletEventStart(ticket.startsAt)?.split(' ').slice(-2).join(' ');
            return (
              <Link key={ticket.ticketId} href={{ pathname: '/my-tickets/[ticketId]', params: { ticketId: ticket.ticketId } }} asChild>
                <Pressable accessibilityRole="button" accessibilityLabel={walletTicketA11yLabel(ticketEventDisplayName(ticket), ticket, status)} style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: colors.ticketCanvas, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.8 : 1 })}>
                  <View style={{ flex: 1, gap: space.xxs }}>
                    <Text numberOfLines={1} style={{ ...typography.footnoteSemibold, color: brand.ink }}>{ticketEventDisplayName(ticket)}</Text>
                    <Text numberOfLines={1} style={{ ...typography.caption, color: colors.secondary }}>{[time, status.label].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Text accessibilityElementsHidden style={{ ...typography.title, color: colors.secondary }}>›</Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      ))}
    </View>
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
    return <VerifiedWallet key={identity.userId} userId={identity.userId} />;
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
          <View style={{ gap: space.sm, marginTop: space.xl }}>
            <AttendeeCta label="Đăng nhập" onPress={() => router.push(ATTENDEE_ACCOUNT_HREF)} testID="wallet-guest-signin" />
            <AttendeeCta label="Khám phá sự kiện" variant="secondary" onPress={() => router.replace(GUEST_HOME_HREF)} testID="wallet-guest-events" />
          </View>
        </ScrollView>
      <AttendeeScreenChrome title="Vé của tôi" />
    </>
  );
}

/**
 * Display-only wallet from prior online-verified binding + durable cache.
 * Grouped by eventId; a cache row without eventName falls back to «Sự kiện» (still distinct by color).
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
  const contentPhase = walletContentPhase({ ticketCount: tickets.length, busy, error, onlineLoaded: false, offline: true });

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

      {contentPhase === 'loading' ? (
        <LoadingState title={walletCopy.loading.title}>
          {walletCopy.loading.body}
        </LoadingState>
      ) : null}

      {error ? (
        <ErrorState title={walletCopy.errorTitle}>{error}</ErrorState>
      ) : null}

      {contentPhase === 'empty-offline' ? (
        <EmptyState title={walletCopy.emptyOffline.title}>
          {walletCopy.emptyOffline.body}
        </EmptyState>
      ) : contentPhase === 'tickets' ? (
        <View style={{ gap: space.xl }}>
          <WalletGroupedTicketList tickets={tickets} offline />
        </View>
      ) : null}

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
  const ticketsRef = useRef(tickets);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);
  const [offline, setOffline] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [onlineLoaded, setOnlineLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [walletFilter, setWalletFilter] = useState<WalletFilter>('upcoming');

  const hydrateFromCache = useCallback(async (isActive: () => boolean) => {
    const epoch = session.captureEpoch();
    if (!epoch || epoch.userId !== userId) return;
    // A warm wallet remains mounted under ticket detail. Preserve its rows,
    // offline notice and scroll geometry while the focus refresh runs.
    if (ticketsRef.current.length > 0 && session.read<TicketSummary[]>(sessionScope, 'me-tickets')) return;
    const cache = await readTicketDisplayCache(userId, cacheScope);
    const decision = decideCacheHydrate({
      epoch,
      isEpochCurrent: (e) => session.isEpochCurrent(e),
      cached: cache,
      expectedUserId: userId
    });
    if (!isActive() || decision.action !== 'apply') return;
    setTickets(decision.tickets);
    setOffline(true);
    setLastSyncedAt(decision.syncedAt);
    if (!session.isEpochCurrent(epoch)) return;
    await session.load(sessionScope, 'me-tickets', async () => decision.tickets);
  }, [cacheScope, sessionScope, userId]);

  const refresh = useCallback(async (isActive: () => boolean = () => true) => {
    const epoch = session.captureEpoch();
    if (!epoch || epoch.userId !== userId) return;

    setError(null);
    setAuthError(false);
    const credential = await session.resolveCredential();
    if (!isActive() || !session.isEpochCurrent(epoch)) return;
    if (credential.status === 'unavailable') {
      setTickets([]);
      setAuthError(true);
      setError('Phiên đăng nhập không còn hiệu lực. Mở Tài khoản để đăng xuất rồi đăng nhập lại.');
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
      if (!isActive() || !session.isEpochCurrent(epoch)) return;

      const cached =
        probe.status === 'ok'
          ? null
          : await readTicketDisplayCache(userId, cacheScope);
      if (!isActive() || !session.isEpochCurrent(epoch)) return;

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
        setTickets([]);
        setAuthError(true);
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
          if (!isActive() || !session.isEpochCurrent(epoch)) return;
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

      if (!isActive() || !session.isEpochCurrent(epoch)) return;
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
        setOnlineLoaded(true);
        if (!isActive() || !session.isEpochCurrent(epoch)) return;
        await persistWalletTicketCaches(
          userId,
          fetchScope,
          decision.tickets,
          decision.syncedAt,
          writeEpoch,
        );
        if (!isActive() || !session.isEpochCurrent(epoch)) return;
        const loaded = await session.load(
          sessionScope,
          'me-tickets',
          async () => decision.tickets,
        );
        if (!loaded || !isActive() || !session.isEpochCurrent(epoch)) return;
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
        if (!isActive() || !session.isEpochCurrent(epoch)) return;
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

  useFocusEffect(
    useCallback(() => {
      return startWalletFocusRefresh({ hydrate: hydrateFromCache, refresh, setBusy });
    }, [hydrateFromCache, refresh]),
  );

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

  const contentPhase = walletContentPhase({
    ticketCount: tickets.length, busy, error, onlineLoaded, offline,
  });

  // A+C hero only applies to the unfiltered wallet view; an event-filtered
  // view keeps its existing flat grouped list (wireframe covers no filter).
  const filteredTickets = useMemo(() => filterWalletTickets(tickets, walletFilter), [tickets, walletFilter]);
  const heroTicket = filterEventId || walletFilter === 'past' ? null : selectHeroTicket(filteredTickets, offline);
  const heroGroup = heroTicket
    ? groupTicketsByEvent(filteredTickets).find((group) => group.eventId === heroTicket.eventId)
    : null;
  const hero = heroTicket && heroGroup ? { ticket: heroTicket, group: heroGroup } : null;
  const remainingTickets = hero
    ? filteredTickets.filter((t) => t.ticketId !== hero.ticket.ticketId)
    : filteredTickets;

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

      <View style={{ gap: space.sm }}>
        <Text style={{ ...typography.caption, color: colors.secondary }}>{walletListSubtitle(tickets.length, countDistinctEvents(tickets))}</Text>
        <WalletFilterBar value={walletFilter} onChange={setWalletFilter} />
      </View>

      {contentPhase === 'loading' ? (
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
          onRetry={authError ? undefined : () => void onRefresh()}
          retryLabel="Làm mới vé"
        >
          {error}
        </ErrorState>
      ) : null}
      {contentPhase === 'error' && authError ? (
        <AttendeeCta label="Mở Tài khoản" onPress={() => router.push(ATTENDEE_ACCOUNT_HREF)} testID="wallet-error-account" />
      ) : null}

      {contentPhase === 'empty-online' ? (
        <EmptyState title={walletCopy.emptyOnline.title}>
          {walletCopy.emptyOnline.body}
        </EmptyState>
      ) : contentPhase === 'tickets' ? (
        <>
          {hero ? (
            <View style={{ gap: space.sm }}>
              <Text style={walletEyebrowStyle}>Vé cần dùng gần nhất</Text>
              <WalletHeroTicket
                ticket={hero.ticket}
                group={hero.group}
                offline={offline}
              />
            </View>
          ) : null}
          {remainingTickets.length > 0 ? (
            <View style={{ gap: space.sm }}>
              {hero ? (
                <Text style={walletEyebrowStyle}>Các vé còn lại</Text>
              ) : null}
              {!filterEventId && walletFilter !== 'all' ? (
                <WalletDateTimeline tickets={remainingTickets} offline={offline} />
              ) : (
                <View style={{ gap: space.xl }}>
                  <WalletGroupedTicketList tickets={remainingTickets} filterEventId={filterEventId} offline={offline} />
                </View>
              )}
            </View>
          ) : null}
        </>
      ) : null}

      {contentPhase === 'empty-online' ? (
        <View style={{ gap: space.sm }}>
          <AttendeeCta label="Khám phá sự kiện" onPress={() => router.push(GUEST_HOME_HREF)} testID="wallet-empty-events" />
          <AttendeeCta label="Đổi mã nhận vé" variant="secondary" onPress={() => router.push(ATTENDEE_REDEEM_PATH)} testID="wallet-empty-redeem" />
        </View>
      ) : null}
      {contentPhase === 'tickets' && filteredTickets.length === 0 ? (
        <EmptyState title={walletFilter === 'past' ? 'Chưa có vé đã qua' : 'Chưa có vé sắp dùng'}>
          {walletFilter === 'past' ? 'Vé đã qua sẽ xuất hiện ở đây.' : 'Vé chưa có ngày bắt đầu vẫn xem được trong Tất cả.'}
        </EmptyState>
      ) : null}
    </ScrollView>
    <AttendeeScreenChrome title="Vé của tôi" />
    </>
  );
}
