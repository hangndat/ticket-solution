import { useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { Notice, Page } from '@/components/page';
import { getApiBaseUrl, getEventId, getTenantId } from '@/identity/config';
import { session } from '@/identity/session';
import { redeemCode, reconcileRedeem, type RedeemDecision } from '@/redeem/redeem-client';
import { colors } from '@/theme/colors';

function titleFor(decision: RedeemDecision | null): string {
  if (!decision) return 'Redeem a code';
  if (decision.kind === 'issued') return decision.replayed ? 'Ticket already issued' : 'Ticket issued';
  if (decision.kind === 'unknown') return 'Unknown — not a ticket';
  return 'Not issued';
}

export function RedeemScreen() {
  const [tenantId, setTenantId] = useState(getTenantId() ?? '');
  const [eventId, setEventId] = useState(getEventId() ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<RedeemDecision | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function submit() {
    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    if (!bearer || !apiBase) {
      setDecision({
        kind: 'denied',
        code: 'UNAUTHENTICATED',
        message: 'Sign in and set the API base before redeeming.',
      });
      return;
    }
    const idempotencyKey = pendingKey ?? crypto.randomUUID();
    setPendingKey(idempotencyKey);
    setBusy(true);
    try {
      const next = await redeemCode({
        apiBase,
        bearer,
        tenantId: tenantId.trim(),
        eventId: eventId.trim(),
        code: code.trim(),
        idempotencyKey,
      });
      setDecision(next);
      if (next.kind !== 'unknown') setPendingKey(null);
    } finally {
      setBusy(false);
    }
  }

  async function reconcile() {
    if (!pendingKey) return;
    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    if (!bearer || !apiBase) return;
    setBusy(true);
    try {
      const next = await reconcileRedeem({
        apiBase,
        bearer,
        tenantId: tenantId.trim(),
        eventId: eventId.trim(),
        idempotencyKey: pendingKey,
      });
      setDecision(next);
      if (next.kind !== 'unknown') setPendingKey(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Notice title="Redeem">
        The app calls the live redeem API. A lost response stays unknown until
        the same idempotency key resolves. It is not a ticket until then.
      </Notice>
      <TextInput
        value={tenantId}
        onChangeText={setTenantId}
        placeholder="Tenant ID"
        autoCapitalize="none"
        style={field}
      />
      <TextInput
        value={eventId}
        onChangeText={setEventId}
        placeholder="Event ID"
        autoCapitalize="none"
        style={field}
      />
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Redemption code"
        autoCapitalize="characters"
        style={field}
      />
      <Pressable
        accessibilityRole="button"
        disabled={busy || code.trim().length === 0}
        onPress={() => void submit()}
        style={button}
      >
        <Text style={buttonLabel}>{busy ? 'Checking…' : 'Redeem'}</Text>
      </Pressable>
      {decision ? <Notice title={titleFor(decision)}>{decision.kind === 'issued' ? decision.ticketId : decision.message}</Notice> : null}
      {decision?.kind === 'issued' ? null : pendingKey ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void reconcile()} style={button}>
          <Text style={buttonLabel}>Reconcile same attempt</Text>
        </Pressable>
      ) : null}
    </Page>
  );
}

const field = {
  minHeight: 48,
  padding: 12,
  borderRadius: 12,
  backgroundColor: colors.card,
  color: colors.label,
  fontSize: 16,
};

const button = {
  padding: 14,
  borderRadius: 12,
  backgroundColor: colors.accent,
};

const buttonLabel = {
  color: 'white',
  fontSize: 17,
  fontWeight: '600' as const,
  textAlign: 'center' as const,
};
