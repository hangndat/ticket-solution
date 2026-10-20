import { Link, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { TicketSummary } from '@ticket/contracts';
import { AttendeeCta } from '@/components/attendee-cta';
import { EventLogo } from '@/components/event-media';
import { BrandWordmark, Notice } from '@/components/page';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/screen-state';
import { eventsCopy, walletCopy } from '@/components/screen-state-copy';
import {
  attendeeWalletCopy,
  presentTicketRow,
} from '@/attendee/attendee-outcome-copy';
import { goToAccount } from '@/navigation/go-to-account-sign-in';
import { useWalletAccess } from '@/navigation/use-wallet-access';
import { TabStackTitle } from '@/navigation/tab-stack-title';
import { hasDemoMediaForEventId } from '@/data/demo-media';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { session } from '@/identity/session';
import {
  currentTicketDisplayWriteEpoch,
  readTicketDisplayCache,
} from '@/tickets/display-cache';
import { probeMeTickets } from '@/tickets/fetch-me-tickets';
import { persistWalletTicketCaches } from '@/tickets/wallet-display-persist';
import {
  walletDisplayCacheScope,
  walletFetchScopeFromEnv,
  walletSessionScope,
} from '@/tickets/wallet-fetch-scope';
import {
  bindIfStillVerified,
  captureOfflineBindingEpoch,
} from '@/tickets/bind-after-verify';
import { offlineDisplay } from '@/tickets/offline-display-session';
import {
  decideCacheHydrate,
  decideTicketSyncApply,
} from '@/tickets/ticket-sync-guard';
import { logoutAndClearWalletArtifacts } from '@/tickets/wallet-logout';
import { isApnsProvider, pushProviderName } from '@/push/push';
import { normalizeIosNotificationPermission } from '@/push/push-permission';
import { WalletPushPromptCard } from '@/push/wallet-push-prompt-card';
import { shouldOfferWalletPushPrompt } from '@/push/wallet-push-prompt-policy';
import { readWalletPushPromptDismissed } from '@/push/wallet-push-prompt-store';
import {
  countDistinctEvents,
  filterTicketsByEventId,
  groupTicketsByEvent,
  resolveWalletFilterEventName,
  walletEventSectionHeader,
  walletListSubtitle,
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
}: {
  tickets: TicketSummary[];
  filterEventId?: string;
}) {
  if (filterEventId) {
    const visible = filterTicketsByEventId(tickets, filterEventId);
    return (
      <>
        {visible.map((ticket) => (
          <TicketRow key={ticket.ticketId} ticket={ticket} />
        ))}
      </>
    );
  }

  const groups = groupTicketsByEvent(tickets);
  return (
    <>
      {groups.map((group) => (
        <View key={group.eventId} style={{ gap: 12 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: brand.ink,
              fontSize: 16,
              fontFamily: fontFamilies.bodySemiBold,
              fontWeight: '600',
            }}
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

function TicketRow({ ticket }: { ticket: TicketSummary }) {
  const [focused, setFocused] = useState(false);
  const row = presentTicketRow(ticket);
  return (
    <Link href={`/my-tickets/${ticket.ticketId}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.accessibilityLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => ({
          padding: 16,
          borderRadius: 14,
          borderCurve: 'continuous',
          backgroundColor: colors.ticketCanvas,
          borderLeftWidth: 4,
          borderLeftColor: brand.signal,
          borderWidth: focused ? 2 : 0,
          borderColor: focused ? colors.focus : 'transparent',
          opacity: pressed ? 0.85 : 1,
          gap: 6,
        })}
      >
        {hasDemoMediaForEventId(ticket.eventId) ? (
          <EventLogo
            eventId={ticket.eventId}
            height={28}
            testID={`ticket-logo-${ticket.ticketId}`}
            accessibilityLabel="Logo sự kiện demo trên vé"
          />
        ) : null}
        <Text
          style={{
            color: brand.ink,
            fontSize: 17,
            fontFamily: fontFamilies.bodySemiBold,
            fontWeight: '600',
          }}
        >
          {row.eventTitle}
        </Text>
        <Text
          style={{
            color: brand.signal,
            fontSize: 15,
            fontFamily: fontFamilies.bodySemiBold,
            fontWeight: '600',
          }}
        >
          {row.statusLabel}
        </Text>
        <Text
          style={{
            color: colors.secondary,
            fontSize: 13,
            fontFamily: fontFamilies.body,
          }}
          selectable
        >
          {row.ticketId}
        </Text>
        <Text
          style={{
            color: colors.secondary,
            fontSize: 12,
            fontFamily: fontFamilies.body,
          }}
          selectable
        >
          {row.credentialLine}
        </Text>
      </Pressable>
    </Link>
  );
}

export function MyTicketsScreen() {
  const { canAccess } = useWalletAccess();
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

  if (!canAccess) {
    return <TabStackTitle title="Vé của tôi" />;
  }

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

  return <TabStackTitle title="Vé của tôi" />;
}

/**
 * Display-only wallet from prior online-verified binding + durable cache.
 * Flat list only: offline cache may lack eventName — no event grouping (#602).
 */
function OfflineDisplayWallet({
  userId,
  tenantId,
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
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
    >
      <Notice title={attendeeWalletCopy.offlineBannerTitle}>
        {attendeeWalletCopy.offlineBannerBody}
        {'\n'}
        Đồng bộ lần cuối: {syncedAt ?? '—'}
      </Notice>
      <Text style={{ color: colors.secondary, fontSize: 13 }}>
        Đang xem vé đã lưu trên thiết bị này.
      </Text>

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
        <View style={{ gap: 12 }}>
          {tickets.map((ticket) => (
            <TicketRow key={ticket.ticketId} ticket={ticket} />
          ))}
        </View>
      )}

      <AttendeeCta
        label={eventsCopy.goToAccountCta}
        variant="secondary"
        onPress={() => goToAccount()}
        testID="wallet-cta-account-offline"
      />
    </ScrollView>
    <TabStackTitle title="Vé của tôi" />
    </>
  );
}

function VerifiedWallet({ userId }: { userId: string }) {
  const { eventId: eventIdParam } = useLocalSearchParams<{ eventId?: string }>();
  const filterEventId = parseWalletEventIdFilter(eventIdParam);
  const fetchScope = walletFetchScopeFromEnv();
  const sessionScope = walletSessionScope(fetchScope);
  const cacheScope = walletDisplayCacheScope(fetchScope);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
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
      expectedUserId: userId,
    });
    if (decision.action !== 'apply') return;
    setTickets(decision.tickets);
    setSyncedAt(decision.syncedAt);
    setOffline(true);
    if (!session.isEpochCurrent(epoch)) return;
    await session.load(sessionScope, 'me-tickets', async () => decision.tickets);
  }, [cacheScope, sessionScope, userId]);

  const refresh = useCallback(async () => {
    const epoch = session.captureEpoch();
    if (!epoch || epoch.userId !== userId) return;

    setError(null);
    const bearer = await session.getCredential();
    if (!session.isEpochCurrent(epoch)) return;
    if (!bearer) {
      setError('Phiên đăng nhập không còn hiệu lực. Đăng nhập lại.');
      return;
    }

    const controller = session.beginRequest();
    // Capture BOTH durable gates before any await so logout cannot be bypassed
    // by bindAfterOnlineVerify defaulting to a post-logout gate.current().
    const writeEpoch = currentTicketDisplayWriteEpoch();
    const bindingEpoch = captureOfflineBindingEpoch();
    try {
      const probe = await probeMeTickets(bearer, fetchScope, controller.signal);
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
            walletScope: fetchScope,
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
      setSyncedAt(decision.syncedAt);
      setOffline(decision.offline);
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
            bindingEpoch,
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
          iosPermissionAuthorized: perm === 'authorized' || perm === 'provisional',
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
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
      }
    >
      <BrandWordmark compact />
      <Text
        style={{
          color: brand.ink,
          fontSize: 17,
          fontWeight: '600',
          fontFamily: fontFamilies.bodySemiBold,
        }}
      >
        {attendeeWalletCopy.verifiedCaption}
      </Text>
      {offline ? (
        <Notice title={attendeeWalletCopy.offlineBannerTitle}>
          {attendeeWalletCopy.offlineBannerBody}
        </Notice>
      ) : null}
      <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 20 }}>
        Đồng bộ: {syncedAt ?? '—'}
        {offline ? ' · bộ đệm offline' : ''}
      </Text>

      {filterEventId ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            paddingVertical: 4,
          }}
        >
          <Text
            style={{
              color: brand.ink,
              fontSize: 15,
              fontFamily: fontFamilies.bodySemiBold,
              fontWeight: '600',
              flexShrink: 1,
            }}
          >
            {resolveWalletFilterEventName(tickets, filterEventId)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xem tất cả vé, bỏ lọc sự kiện"
            onPress={() => router.replace('/(tabs)/my-tickets')}
            testID="wallet-clear-event-filter"
          >
            <Text
              style={{
                color: brand.signal,
                fontSize: 15,
                fontFamily: fontFamilies.bodySemiBold,
                fontWeight: '600',
              }}
            >
              Xem tất cả
            </Text>
          </Pressable>
        </View>
      ) : tickets.length > 0 ? (
        <Text
          style={{
            color: colors.secondary,
            fontSize: 15,
            fontFamily: fontFamilies.body,
          }}
        >
          {walletListSubtitle(
            tickets.length,
            countDistinctEvents(tickets),
          )}
        </Text>
      ) : null}

      {busy && tickets.length === 0 ? (
        <LoadingState title={walletCopy.loading.title}>
          {walletCopy.loading.body}
        </LoadingState>
      ) : null}

      {showPushPrompt && tickets.length > 0 ? (
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
        <View style={{ gap: 16 }}>
          <WalletGroupedTicketList
            tickets={tickets}
            filterEventId={filterEventId}
          />
        </View>
      )}

      {tickets.length === 0 && !busy ? (
        <AttendeeCta
          label="Đổi mã lấy vé"
          variant="secondary"
          onPress={() => router.push('/redeem-global')}
        />
      ) : null}
      <AttendeeCta
        label="Làm mới vé"
        onPress={() => void onRefresh()}
        disabled={busy || refreshing}
      />
      <AttendeeCta
        label={eventsCopy.goToAccountCta}
        variant="secondary"
        onPress={() => goToAccount()}
        testID="wallet-cta-account-verified"
      />

      <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 18 }}>
        Vé đã cache mở được khi mất mạng chỉ để xem. Không phải check-in offline;
        cổng vẫn quyết định trên máy chủ. Đăng xuất và cài đặt tại Tài khoản.
      </Text>
    </ScrollView>
    <TabStackTitle title="Vé của tôi" />
    </>
  );
}
