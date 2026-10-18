import { Link } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { TicketSummary } from '@ticket/contracts';
import { EventLogo } from '@/components/event-media';
import { BrandWordmark, Notice } from '@/components/page';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/screen-state';
import { walletCopy } from '@/components/screen-state-copy';
import {
  attendeeWalletCopy,
  presentTicketRow,
} from '@/attendee/attendee-outcome-copy';
import { hasDemoMediaForEventId } from '@/data/demo-media';
import { brand, colors } from '@/theme/colors';
import { isOidcConfigured, getTenantId } from '@/identity/config';
import { verifyViaMe } from '@/identity/fetch-me';
import {
  endKeycloakSession,
  loginWithKeycloak,
} from '@/identity/oidc-login';
import { session } from '@/identity/session';
import {
  currentTicketDisplayWriteEpoch,
  readTicketDisplayCache,
  writeTicketDisplayCache,
} from '@/tickets/display-cache';
import { probeMeTickets } from '@/tickets/fetch-me-tickets';
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
import { AccountScreen } from '@/screens/account';
import { SessionScopedPushStatus } from '@/push/push-status';

function ActionButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: colors.accent,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        borderWidth: focused ? 2 : 0,
        borderColor: colors.focus,
      })}
    >
      <Text
        style={{
          color: colors.onAccent,
          fontSize: 17,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
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
        <Text style={{ color: brand.ink, fontSize: 17, fontWeight: '600' }}>
          {row.eventTitle}
        </Text>
        <Text style={{ color: brand.signal, fontSize: 15, fontWeight: '600' }}>
          {row.statusLabel}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 13 }} selectable>
          {row.ticketId}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 12 }} selectable>
          {row.credentialLine}
        </Text>
      </Pressable>
    </Link>
  );
}

export function MyTicketsScreen() {
  const configured = isOidcConfigured();
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

  if (!configured) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
      >
        <AccountScreen />
      </ScrollView>
    );
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

  return <SignedOutWallet />;
}

function SignedOutWallet() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // Account switch / new login: do not hydrate the previous offline user.
      try {
        await offlineDisplay.clear();
      } catch {
        /* continue sign-in; prior binding clear best-effort */
      }
      const bindingEpoch = captureOfflineBindingEpoch();
      const result = await loginWithKeycloak();
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      await session.establish(result.accessToken, verifyViaMe);
      const snap = session.getSnapshot();
      const tenantId = getTenantId();
      if (snap.status === 'verified' && tenantId) {
        await bindIfStillVerified({
          session,
          offline: offlineDisplay,
          userId: snap.userId,
          tenantId,
          bindingEpoch,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Đăng nhập thất bại.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
    >
      <BrandWordmark />
      <Notice title={attendeeWalletCopy.signedOutTitle}>
        {attendeeWalletCopy.signedOutBody}
      </Notice>
      <Text style={{ color: colors.secondary, fontSize: 15 }}>
        Trạng thái: chưa đăng nhập
      </Text>
      <ActionButton
        label="Đăng nhập"
        onPress={() => void onSignIn()}
        disabled={busy}
      />
      {busy ? (
        <LoadingState title={walletCopy.signInLoading.title}>
          {walletCopy.signInLoading.body}
        </LoadingState>
      ) : null}
      {error ? (
        <ErrorState title={walletCopy.signInErrorTitle}>{error}</ErrorState>
      ) : null}
    </ScrollView>
  );
}

/** Display-only wallet from prior online-verified binding + durable cache. */
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

  const onLogout = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await logoutAndClearWalletArtifacts({ userId, tenantId });
      await endKeycloakSession();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Đăng xuất thất bại khi xóa SecureStore / bộ đệm vé.',
      );
    } finally {
      setBusy(false);
    }
  }, [userId, tenantId]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
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

      <ActionButton
        label="Đăng xuất"
        onPress={() => void onLogout()}
        disabled={busy}
      />
    </ScrollView>
  );
}

function VerifiedWallet({ userId }: { userId: string }) {
  const tenantId = getTenantId();
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hydrateFromCache = useCallback(async () => {
    if (!tenantId) return;
    const epoch = session.captureEpoch();
    if (!epoch || epoch.userId !== userId) return;
    const cache = await readTicketDisplayCache(userId, tenantId);
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
    await session.load(tenantId, 'me-tickets', async () => decision.tickets);
  }, [tenantId, userId]);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setError('Thiếu cấu hình tổ chức trên bản dựng. Không tải được vé.');
      return;
    }
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
      const probe = await probeMeTickets(bearer, tenantId, controller.signal);
      if (!session.isEpochCurrent(epoch)) return;

      const cached =
        probe.status === 'ok'
          ? null
          : await readTicketDisplayCache(userId, tenantId);
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
          await logoutAndClearWalletArtifacts({ userId, tenantId });
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
        await writeTicketDisplayCache(
          {
            userId,
            tenantId,
            syncedAt: decision.syncedAt,
            tickets: decision.tickets,
          },
          writeEpoch,
        );
        if (!session.isEpochCurrent(epoch)) return;
        const loaded = await session.load(
          tenantId,
          'me-tickets',
          async () => decision.tickets,
        );
        if (!loaded || !session.isEpochCurrent(epoch)) return;
        await bindIfStillVerified({
          session,
          offline: offlineDisplay,
          userId,
          tenantId,
          bindingEpoch,
        });
      } else if (decision.action === 'offline-cache') {
        if (!session.isEpochCurrent(epoch)) return;
        await session.load(tenantId, 'me-tickets', async () => decision.tickets);
      }
    } finally {
      session.endRequest(controller);
    }
  }, [tenantId, userId]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const onLogout = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await logoutAndClearWalletArtifacts({
        userId,
        tenantId: tenantId ?? null,
      });
      await endKeycloakSession();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Đăng xuất thất bại khi xóa SecureStore / bộ đệm vé.',
      );
    } finally {
      setBusy(false);
    }
  }, [tenantId, userId]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
      }
    >
      <BrandWordmark compact />
      <Text style={{ color: brand.ink, fontSize: 17, fontWeight: '600' }}>
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
        {!tenantId ? '\nChưa cấu hình tổ chức trên bản dựng này.' : ''}
      </Text>

      {busy && tickets.length === 0 ? (
        <LoadingState title={walletCopy.loading.title}>
          {walletCopy.loading.body}
        </LoadingState>
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
        <View style={{ gap: 12 }}>
          {tickets.map((ticket) => (
            <TicketRow key={ticket.ticketId} ticket={ticket} />
          ))}
        </View>
      )}

      <ActionButton
        label="Làm mới vé"
        onPress={() => void onRefresh()}
        disabled={busy || refreshing}
      />
      <ActionButton
        label="Đăng xuất"
        onPress={() => void onLogout()}
        disabled={busy}
      />

      <SessionScopedPushStatus />

      <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 18 }}>
        Vé đã cache mở được khi mất mạng chỉ để xem. Không phải check-in offline;
        cổng vẫn quyết định trên máy chủ.
      </Text>
    </ScrollView>
  );
}
