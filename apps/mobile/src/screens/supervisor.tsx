import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Notice, Page } from '@/components/page';
import { parseScan } from '@/gate/gate-scan';
import {
  idleSnapshot,
  outcomeTitle,
  performSupervisorAction,
  presentsAsAdmitted,
  type SupervisorAction,
  type SupervisorSnapshot,
} from '@/gate/supervisor';
import { getApiBaseUrl, getEventId, getTenantId } from '@/identity/config';
import { session } from '@/identity/session';
import { colors } from '@/theme/colors';

const ACTIONS: { action: SupervisorAction; label: string }[] = [
  { action: 'open-session', label: 'Open staff session' },
  { action: 'revoke-session', label: 'Revoke staff session' },
  { action: 'reserve', label: 'Reserve check-in' },
  { action: 'confirm', label: 'Confirm check-in' },
  { action: 'undo', label: 'Undo check-in' },
  { action: 'revoke-ticket', label: 'Revoke ticket' },
];

function waitingSnapshot(previous: SupervisorSnapshot): SupervisorSnapshot {
  return {
    ...previous,
    phase: 'unknown',
    admitted: false,
    message: 'Waiting for the server. Do not admit.',
  };
}

export function SupervisorScreen() {
  const [raw, setRaw] = useState('');
  const [reason, setReason] = useState('');
  const [snapshot, setSnapshot] = useState<SupervisorSnapshot>(idleSnapshot);
  const [busy, setBusy] = useState(false);
  const [ticketId, setTicketId] = useState<string | undefined>();

  async function run(action: SupervisorAction) {
    if (busy) return;
    const parsed = parseScan(raw, {
      tenantId: getTenantId(),
      eventId: getEventId(),
    });
    const nextTicket = parsed?.ticketId ?? ticketId;
    if (parsed?.ticketId) setTicketId(parsed.ticketId);
    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    const tenantId = parsed?.tenantId ?? getTenantId();
    const eventId = parsed?.eventId ?? getEventId();
    if (!bearer || !apiBase || !tenantId || !eventId) {
      setSnapshot({
        ...snapshot,
        phase: 'denied',
        admitted: false,
        message: 'Sign in and set API, tenant, and event before supervising. Do not admit.',
      });
      return;
    }
    setBusy(true);
    setSnapshot(waitingSnapshot(snapshot));
    try {
      const next = await performSupervisorAction({
        action,
        bearer,
        apiBase,
        tenantId,
        eventId,
        previous: snapshot,
        ticketId: nextTicket,
        reason,
      });
      setSnapshot(next);
      if (next.ticketId) setTicketId(next.ticketId);
    } finally {
      setBusy(false);
    }
  }

  const title = outcomeTitle(snapshot);

  return (
    <Page>
      <Notice title="Supervisor">
        Open or revoke a staff session, then reserve, confirm, undo, or revoke
        a ticket. A lost response stays unknown and is not an admission.
      </Notice>
      <TextInput
        accessibilityLabel="Ticket code"
        value={raw}
        onChangeText={setRaw}
        placeholder="Paste QR JSON or ticket id"
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        style={{
          minHeight: 88,
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.card,
          color: colors.label,
          fontSize: 16,
        }}
      />
      <TextInput
        accessibilityLabel="Reason"
        value={reason}
        onChangeText={setReason}
        placeholder="Reason for undo or revoke"
        autoCorrect={false}
        style={{
          minHeight: 48,
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.card,
          color: colors.label,
          fontSize: 16,
        }}
      />
      {ACTIONS.map((item) => (
        <Pressable
          key={item.action}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          disabled={busy}
          onPress={() => void run(item.action)}
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: item.action === 'confirm' ? colors.accent : colors.card,
          }}
        >
          <Text
            style={{
              color: item.action === 'confirm' ? 'white' : colors.label,
              fontSize: 17,
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            {busy ? 'Waiting…' : item.label}
          </Text>
        </Pressable>
      ))}
      <View accessibilityRole="summary" accessibilityLabel={title}>
        <Notice title={title}>{snapshot.message}</Notice>
        {presentsAsAdmitted(snapshot) && snapshot.checkinId ? (
          <Text selectable style={{ color: colors.secondary }}>
            Check-in {snapshot.checkinId}
          </Text>
        ) : null}
        {snapshot.sessionId ? (
          <Text selectable style={{ color: colors.secondary }}>
            Session {snapshot.sessionId}
          </Text>
        ) : null}
      </View>
    </Page>
  );
}
