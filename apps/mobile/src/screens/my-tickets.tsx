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
  readTicketDisplayCache,
  writeTicketDisplayCache,
} from '@/tickets/display-cache';
import { fetchMeTickets } from '@/tickets/fetch-me-tickets';
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

  if (identity.status !== 'verified') {
    return <SignedOutWallet />;
  }

  return <VerifiedWallet userId={identity.userId} />;
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
      const result = await loginWithKeycloak();
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      await session.establish(result.accessToken, verifyViaMe);
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
    const cache = await readTicketDisplayCache(userId, tenantId);
    if (!cache) return;
    setTickets(cache.tickets);
    setSyncedAt(cache.syncedAt);
    setOffline(true);
    // Seed in-memory SessionBoundary cache for detail navigation.
    await session.load(tenantId, 'me-tickets', async () => cache.tickets);
  }, [tenantId, userId]);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setError(
        'EXPO_PUBLIC_TENANT_ID is required for GET /v1/me/tickets?tenantId=.',
      );
      return;
    }
    setError(null);
    const bearer = await session.getCredential();
    if (!bearer) {
      setError('No verified bearer in SecureStore. Sign in again.');
      return;
    }
    const result = await fetchMeTickets(bearer, tenantId);
    if (!result) {
      // Keep showing cache if present.
      const cache = await readTicketDisplayCache(userId, tenantId);
      if (cache) {
        setTickets(cache.tickets);
        setSyncedAt(cache.syncedAt);
        setOffline(true);
        setError(
          'Could not refresh from API. Showing last offline display cache. Status may have changed.',
        );
        return;
      }
      setError(
        'GET /v1/me/tickets failed. Check API base URL, tenantId, and that Nest is running.',
      );
      return;
    }
    const at = new Date().toISOString();
    setTickets(result.tickets);
    setSyncedAt(at);
    setOffline(false);
    await writeTicketDisplayCache({
      userId,
      tenantId,
      syncedAt: at,
      tickets: result.tickets,
    });
    await session.load(tenantId, 'me-tickets', async () => result.tickets);
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
      await session.logout();
      await endKeycloakSession();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Logout failed while clearing SecureStore.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

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
