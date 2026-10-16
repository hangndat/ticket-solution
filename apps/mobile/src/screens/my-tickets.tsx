import { Link } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { TicketSummary } from '@ticket/contracts';
import { Notice } from '@/components/page';
import { colors } from '@/theme/colors';
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

function ActionButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: colors.accent,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: '#fff',
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
  return (
    <Link href={`/my-tickets/${ticket.ticketId}`} asChild>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => ({
          padding: 16,
          borderRadius: 14,
          borderCurve: 'continuous',
          backgroundColor: colors.card,
          opacity: pressed ? 0.85 : 1,
          gap: 6,
        })}
      >
        <Text style={{ color: colors.label, fontSize: 17, fontWeight: '600' }}>
          {ticket.state} · v{ticket.credentialVersion}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 15 }} selectable>
          {ticket.ticketId}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 13 }}>
          Event {ticket.eventId.slice(0, 8)}…
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
        <Notice title="OIDC is not configured">
          Set EXPO_PUBLIC_OIDC_ISSUER and EXPO_PUBLIC_OIDC_CLIENT_ID (see
          .env.example). Without Keycloak this build stays signed out and never
          stubs a verified user or tickets.
        </Notice>
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
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

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
      setError(err instanceof Error ? err.message : 'Keycloak sign-in failed.');
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
      <Notice title="My Tickets">
        Sign in with the same Keycloak identity as web. SessionBoundary becomes
        verified only after GET /v1/me — tickets then load from GET
        /v1/me/tickets.
      </Notice>
      <Notice title="Session">
        SessionBoundary: {identity.status}
      </Notice>
      <ActionButton
        label="Sign in"
        onPress={() => void onSignIn()}
        disabled={busy}
      />
      {busy ? <ActivityIndicator /> : null}
      {error ? <Notice title="Sign-in failed">{error}</Notice> : null}
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
            'Offline display binding exists but no ticket cache was found for this account.',
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
              : 'Failed to read offline display cache.',
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
          : 'Logout failed while clearing SecureStore / ticket cache.',
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
      <Notice title="Offline display">
        Showing saved tickets for a previously online-verified account on this
        device. This is not SessionBoundary verified and does not authorize API
        calls or Gate check-in.
        {'\n'}
        Bound user: {userId}
        {'\n'}
        Tenant: {tenantId}
        {'\n'}
        Last synced: {syncedAt ?? '—'}
      </Notice>

      {busy && tickets.length === 0 ? (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : null}

      {error ? <Notice title="Notice">{error}</Notice> : null}

      {tickets.length === 0 && !busy ? (
        <Notice title="No cached tickets">
          Pull to refresh after signing in online to populate offline display
          cache.
        </Notice>
      ) : (
        <View style={{ gap: 12 }}>
          {tickets.map((ticket) => (
            <TicketRow key={ticket.ticketId} ticket={ticket} />
          ))}
        </View>
      )}

      <ActionButton
        label="Log out"
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
      setError(
        'EXPO_PUBLIC_TENANT_ID is required for GET /v1/me/tickets?tenantId=.',
      );
      return;
    }
    const epoch = session.captureEpoch();
    if (!epoch || epoch.userId !== userId) return;

    setError(null);
    const bearer = await session.getCredential();
    if (!session.isEpochCurrent(epoch)) return;
    if (!bearer) {
      setError('No verified bearer in SecureStore. Sign in again.');
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
          'GET /v1/me/tickets returned 401/403. Session is no longer authorized — sign in again. Offline cache was not used.',
        );
        try {
          await logoutAndClearWalletArtifacts({ userId, tenantId });
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Authorized session ended but durable logout cleanup failed.',
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
          : 'Logout failed while clearing SecureStore / ticket cache.',
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
      <Notice title="Identity">
        SessionBoundary: verified ({userId})
        {'\n'}
        Same OIDC subject path as web — verified only via GET /v1/me.
        {'\n'}
        Tenant: {tenantId ?? '(set EXPO_PUBLIC_TENANT_ID)'}
        {'\n'}
        Last synced: {syncedAt ?? '—'}
        {offline ? ' · offline cache' : ''}
      </Notice>

      {busy && tickets.length === 0 ? (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : null}

      {error ? <Notice title="Notice">{error}</Notice> : null}

      {tickets.length === 0 && !busy ? (
        <Notice title="No tickets yet">
          Redeem a code on web with this same Keycloak account, then pull to
          refresh. Empty list means the API returned zero owner tickets — not a
          mock wallet.
        </Notice>
      ) : (
        <View style={{ gap: 12 }}>
          {tickets.map((ticket) => (
            <TicketRow key={ticket.ticketId} ticket={ticket} />
          ))}
        </View>
      )}

      <ActionButton
        label="Refresh tickets"
        onPress={() => void onRefresh()}
        disabled={busy || refreshing}
      />
      <ActionButton
        label="Log out"
        onPress={() => void onLogout()}
        disabled={busy}
      />

      <Notice title="Offline display">
        Cached TicketSummary rows open without network for display only. This is
        not offline check-in; Gate still decides admission on the server.
      </Notice>
    </ScrollView>
  );
}
