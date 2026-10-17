import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Notice, Page } from '@/components/page';
import { gateOpFromQueued, runScan } from '@/gate/gate-scan';
import { probeConnectivity } from '@/gate/offline-queue';
import { offlineScanQueue } from '@/gate/offline-queue-session';
import { loadGateOps, saveGateOps } from '@/gate/gate-store';
import {
  getApiBaseUrl,
  getEventId,
  getTenantId,
} from '@/identity/config';
import { session } from '@/identity/session';
import { colors } from '@/theme/colors';

/**
 * Headless sim-uat helper: submit a gate scan without HID typing into TextInput.
 * Requires an already-verified staff session. Never invents admission.
 *
 * preferOffline=1 → open staff session online once, then enqueue CHECKIN_OFFLINE.
 */
export default function UatScanRoute() {
  const params = useLocalSearchParams<{
    ticketId?: string | string[];
    preferOffline?: string | string[];
  }>();
  const [status, setStatus] = useState('Đang quét UAT…');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rawTicket = params.ticketId;
      const ticketId = Array.isArray(rawTicket) ? rawTicket[0] : rawTicket;
      const preferRaw = params.preferOffline;
      const preferOffline =
        (Array.isArray(preferRaw) ? preferRaw[0] : preferRaw) === '1';

      if (!ticketId || !/^[0-9a-f-]{36}$/i.test(ticketId)) {
        setStatus('Thiếu ticketId UUID.');
        return;
      }
      const snap = session.getSnapshot();
      if (snap.status !== 'verified') {
        setStatus('Cần staff verified trước (uat/staff-session).');
        return;
      }
      const apiBase = getApiBaseUrl();
      const bearer = await session.getCredential();
      if (!apiBase || !bearer) {
        setStatus('Thiếu API base / bearer.');
        return;
      }

      try {
        setStatus(`bindUser uid=${snap.userId.slice(0, 8)}…`);
        await offlineScanQueue.bindUser(snap.userId);
        setStatus('loadGateOps…');
        const ops = await loadGateOps();
        const tenantId = getTenantId();
        const eventId = getEventId();
        if (!tenantId || !eventId) {
          setStatus(
            `Thiếu TENANT/EVENT (t=${tenantId ?? 'null'} e=${eventId ?? 'null'}).`,
          );
          return;
        }
        const payload = JSON.stringify({
          kind: 'ticket.display',
          ticketId,
          tenantId,
          eventId,
        });

        setStatus(
          preferOffline
            ? `runScan session+offline api=${apiBase}…`
            : `runScan online api=${apiBase}…`,
        );
        // preferOffline: open staff session online, then stop before reserve/confirm
        // so UAT can enqueue CHECKIN_OFFLINE without a live admission attempt.
        const online = await Promise.race([
          runScan({
            raw: payload,
            bearer,
            apiBase,
            ops,
            staffSessionId: null,
            preferOfflineQueue: preferOffline,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('runScan timeout 15s')), 15000),
          ),
        ]).catch((err: Error) => {
          return {
            ops,
            staffSessionId: null,
            current: {
              id: 'uat-timeout',
              ticketId: '',
              tenantId: '',
              eventId: '',
              staffSessionId: '',
              phase: 'unknown' as const,
              message: err.message,
            },
            parsed: undefined,
          };
        });
        if (cancelled) return;
        await saveGateOps(online.ops);

        if (!online.staffSessionId || !online.parsed) {
          setStatus(
            `SESSION_OPEN_FAILED phase=${online.current?.phase ?? 'none'} msg=${online.current?.message?.slice(0, 80) ?? ''}`,
          );
          await new Promise((r) => setTimeout(r, 8000));
          if (!cancelled) router.replace('/(tabs)/staff' as never);
          return;
        }

        if (!preferOffline) {
          setStatus(
            `ONLINE_SCAN phase=${online.current?.phase ?? 'none'} session=yes`,
          );
          await new Promise((r) => setTimeout(r, 8000));
          if (!cancelled) router.replace('/(tabs)/staff' as never);
          return;
        }

        // Force offline enqueue path (session already opened; no online admit).
        const queued = await offlineScanQueue.enqueue({
          ticketId: online.parsed.ticketId,
          tenantId: online.parsed.tenantId,
          eventId: online.parsed.eventId,
          staffSessionId: online.staffSessionId,
        });
        const currentOp = gateOpFromQueued({
          id: queued.clientEventId,
          ticketId: queued.ticketId,
          tenantId: queued.tenantId,
          eventId: queued.eventId,
          staffSessionId: queued.staffSessionId,
          clientEventId: queued.clientEventId,
          message: queued.lastMessage,
        });
        await saveGateOps([currentOp, ...online.ops]);
        const pending = offlineScanQueue.getSnapshot().pendingCount;
        void probeConnectivity(apiBase);
        setStatus(`OFFLINE_ENQUEUED pending=${pending}`);
        // Hold status for sim-uat screenshot before navigating Staff.
        await new Promise((r) => setTimeout(r, 8000));
        if (!cancelled) router.replace('/(tabs)/staff' as never);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`UAT_SCAN_ERROR ${msg.slice(0, 160)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.preferOffline, params.ticketId]);

  return (
    <Page>
      <Notice title="UAT gate scan">Headless scan helper (sim-uat).</Notice>
      <Text style={{ color: colors.label, fontSize: 16 }}>{status}</Text>
    </Page>
  );
}
