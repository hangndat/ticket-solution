import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Pressable, Text, TextInput, View } from 'react-native';
import {
  gateCheckInAnnouncement,
  gateOutcomeAnnouncement,
  gateReconcileAnnouncement,
  supervisorListAnnouncement,
  supervisorUnknownItemAnnouncement,
} from '@/a11y/announcements';
import { BrandWordmark, Notice, Page } from '@/components/page';
import {
  EmptyState,
  LoadingState,
} from '@/components/screen-state';
import { scanCopy } from '@/components/screen-state-copy';
import {
  SUPERVISOR_NOT_ADMISSION,
  canReconcile,
  gateOpFromQueued,
  listUnknownGateOps,
  reconcileOp,
  runScan,
  type GateOp,
} from '@/gate/gate-scan';
import { GateCamera } from '@/gate/gate-camera';
import {
  offlineBannerCopy,
  probeConnectivity,
  type ConnectivityState,
} from '@/gate/offline-queue';
import { offlineScanQueue } from '@/gate/offline-queue-session';
import { loadGateOps, saveGateOps } from '@/gate/gate-store';
import { getApiBaseUrl, getEventId, getTenantId } from '@/identity/config';
import { verifyViaMe } from '@/identity/fetch-me';
import { session } from '@/identity/session';
import { colors } from '@/theme/colors';

/**
 * Gate needs a verified bearer + baked API base. If cold-start left the
 * keychain token in "unreachable → signed-out", re-probe /v1/me before deny.
 */
async function resolveGateAuth(): Promise<
  | { ok: true; bearer: string; apiBase: string }
  | { ok: false; message: string }
> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return {
      ok: false,
      message:
        'Thiếu EXPO_PUBLIC_API_BASE_URL (bake Release/TestFlight). Không cho vào.',
    };
  }

  let bearer = await session.getCredential();
  if (!bearer) {
    await session.restore(verifyViaMe);
    bearer = await session.getCredential();
  }
  if (!bearer) {
    return {
      ok: false,
      message: 'Đăng nhập staff (Account → Đăng nhập) trước khi quét. Không cho vào.',
    };
  }
  return { ok: true, bearer, apiBase };
}

function outcomeTitle(op: GateOp | null): string {
  if (!op) return 'Chờ mã';
  if (op.phase === 'admitted') return 'Cho vào';
  if (op.phase === 'queued') return 'Đã xếp hàng offline';
  if (op.phase === 'unknown') return 'Chưa rõ — không cho vào';
  return 'Không cho vào';
}

function outcomeTone(
  phase: GateOp['phase'] | undefined,
): 'admit' | 'deny' | 'unknown' | 'default' {
  if (phase === 'admitted') return 'admit';
  if (phase === 'queued') return 'unknown';
  if (phase === 'unknown') return 'unknown';
  if (phase === 'denied') return 'deny';
  return 'default';
}

export function StaffScreen() {
  const [raw, setRaw] = useState('');
  const [ops, setOps] = useState<GateOp[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [current, setCurrent] = useState<GateOp | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [checkInFocused, setCheckInFocused] = useState(false);
  const [connectivity, setConnectivity] = useState<ConnectivityState>('unknown');
  const lock = useRef(false);

  const queueSnap = useSyncExternalStore(
    offlineScanQueue.subscribe,
    offlineScanQueue.getSnapshot,
    offlineScanQueue.getSnapshot,
  );

  const persist = useCallback(async (next: GateOp[], active: GateOp | null) => {
    setOps(next);
    setCurrent(active);
    await saveGateOps(next);
  }, []);

  const refreshConnectivityAndSync = useCallback(async () => {
    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      setConnectivity('unknown');
      return;
    }
    const state = await probeConnectivity(apiBase);
    setConnectivity(state);
    if (state !== 'online') return;
    const bearer = await session.getCredential();
    if (!bearer) return;
    await offlineScanQueue.replay({ bearer, apiBase });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await offlineScanQueue.hydrate();
      const loaded = await loadGateOps();
      if (cancelled) return;
      setOps(loaded);
      setCurrent(loaded[0] ?? null);
      setReady(true);
      await refreshConnectivityAndSync();
    })();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshConnectivityAndSync();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [refreshConnectivityAndSync]);

  async function submitScan(payload: string = raw) {
    const code = payload.trim();
    if (!code || lock.current) return;
    lock.current = true;
    const auth = await resolveGateAuth();
    if (!auth.ok) {
      setCurrent({
        id: 'local',
        ticketId: '',
        tenantId: '',
        eventId: '',
        staffSessionId: '',
        phase: 'denied',
        message: auth.message,
      });
      lock.current = false;
      return;
    }
    setBusy(true);
    try {
      const preferOffline = connectivity === 'offline';
      const result = await runScan({
        raw: code,
        bearer: auth.bearer,
        apiBase: auth.apiBase,
        ops,
        staffSessionId: sessionId,
        fallback: { tenantId: getTenantId(), eventId: getEventId() },
        preferOfflineQueue: preferOffline,
      });
      setSessionId(result.staffSessionId);

      if (result.networkUnavailable && result.parsed && result.staffSessionId) {
        const queued = await offlineScanQueue.enqueue({
          ticketId: result.parsed.ticketId,
          tenantId: result.parsed.tenantId,
          eventId: result.parsed.eventId,
          staffSessionId: result.staffSessionId,
        });
        setConnectivity('offline');
        const currentOp = gateOpFromQueued({
          id: queued.clientEventId,
          ticketId: queued.ticketId,
          tenantId: queued.tenantId,
          eventId: queued.eventId,
          staffSessionId: queued.staffSessionId,
          clientEventId: queued.clientEventId,
          message: queued.lastMessage,
        });
        await persist([currentOp, ...result.ops], currentOp);
        return;
      }

      if (result.networkUnavailable) {
        setConnectivity('offline');
      } else if (preferOffline === false) {
        setConnectivity('online');
      }

      await persist(result.ops, result.current);
      if (!result.networkUnavailable) {
        void offlineScanQueue.replay({ bearer, apiBase });
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function reconcile() {
    if (!current || !canReconcile(current)) return;
    const auth = await resolveGateAuth();
    if (!auth.ok) return;
    setBusy(true);
    try {
      const next = await reconcileOp({
        op: current,
        bearer: auth.bearer,
        apiBase: auth.apiBase,
      });
      const rest = ops.filter((op) => op.id !== current.id);
      await persist([next, ...rest], next);
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    if (!bearer || !apiBase) return;
    setBusy(true);
    try {
      setConnectivity(await probeConnectivity(apiBase));
      await offlineScanQueue.replay({ bearer, apiBase });
    } finally {
      setBusy(false);
    }
  }

  const banner = offlineBannerCopy({
    connectivity,
    pendingCount: queueSnap.pendingCount,
    conflictCount: queueSnap.conflictCount,
    syncing: queueSnap.syncing,
    lastSyncError: queueSnap.lastSyncError,
  });

  const recentQueue = queueSnap.items.slice(0, 8);

  return (
    <Page>
      <BrandWordmark compact />
      <Notice title={banner.title} tone={banner.tone}>
        {banner.body}
      </Notice>
      <Notice title="Quét cổng">
        Quét hoặc dán QR hiển thị trên vé. Chỉ cho vào sau khi API ghi nhận
        check-in. Offline: xếp hàng trên máy, đồng bộ khi có mạng — không cho vào
        sớm. Phản hồi mất vẫn giữ “chưa rõ” sau khi mở lại app.
        {'\n'}
        API: {getApiBaseUrl() ?? 'chưa bake'} · Phiên: {session.getSnapshot().status}
      </Notice>
      {!ready ? (
        <LoadingState title={scanCopy.loadingStore.title}>
          {scanCopy.loadingStore.body}
        </LoadingState>
      ) : null}
      <GateCamera disabled={busy || !ready} onScan={(data) => void submitScan(data)} />
      <TextInput
        testID="gate-scan-input"
        value={raw}
        onChangeText={setRaw}
        placeholder="Dán JSON QR hoặc ticket id"
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        editable={ready && !busy}
        selectionColor={colors.focus}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        blurOnSubmit
        onSubmitEditing={() => void submitScan()}
        style={{
          minHeight: 88,
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.card,
          color: colors.label,
          fontSize: 16,
          borderWidth: 2,
          borderColor: inputFocused ? colors.focus : 'transparent',
          opacity: ready ? 1 : 0.55,
        }}
      />
      <Pressable
        {...gateCheckInAnnouncement()}
        testID="gate-checkin-button"
        accessibilityState={{ disabled: busy || !ready || raw.trim().length === 0 }}
        disabled={busy || !ready || raw.trim().length === 0}
        onPress={() => void submitScan()}
        onFocus={() => setCheckInFocused(true)}
        onBlur={() => setCheckInFocused(false)}
        style={{
          padding: 14,
          borderRadius: 12,
          backgroundColor: colors.accent,
          borderWidth: checkInFocused ? 2 : 0,
          borderColor: colors.focus,
        }}
      >
        <Text
          style={{
            color: colors.onAccent,
            fontSize: 17,
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          {busy ? 'Đang kiểm tra…' : 'Check-in'}
        </Text>
      </Pressable>
      {busy ? (
        <LoadingState title={scanCopy.checking.title}>
          {scanCopy.checking.body}
        </LoadingState>
      ) : null}
      {!busy && ready && !current ? (
        <EmptyState title={scanCopy.idle.title}>{scanCopy.idle.body}</EmptyState>
      ) : null}
      {queueSnap.pendingCount > 0 || queueSnap.conflictCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đồng bộ hàng đợi offline"
          accessibilityState={{ disabled: busy || queueSnap.syncing }}
          disabled={busy || queueSnap.syncing}
          onPress={() => void syncNow()}
          style={{ padding: 14, borderRadius: 12, backgroundColor: colors.card }}
        >
          <Text style={{ color: colors.label, fontSize: 17, textAlign: 'center' }}>
            {queueSnap.syncing ? 'Đang đồng bộ…' : 'Đồng bộ hàng đợi ngay'}
          </Text>
        </Pressable>
      ) : null}
      {current ? (
        <View
          {...gateOutcomeAnnouncement({
            phase: current.phase === 'queued' ? 'unknown' : current.phase,
            title: outcomeTitle(current),
            message: current.message,
          })}
          accessibilityLiveRegion={
            current.phase === 'unknown' || current.phase === 'queued'
              ? 'assertive'
              : 'polite'
          }
        >
          <Notice title={outcomeTitle(current)} tone={outcomeTone(current.phase)}>
            {current.message}
          </Notice>
          {current.checkinId ? (
            <Text selectable style={{ color: colors.secondary }}>
              Check-in {current.checkinId}
            </Text>
          ) : null}
        </View>
      ) : null}
      {current && canReconcile(current) ? (
        <Pressable
          {...gateReconcileAnnouncement()}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void reconcile()}
          style={{ padding: 14, borderRadius: 12, backgroundColor: colors.card }}
        >
          <Text style={{ color: colors.label, fontSize: 17, textAlign: 'center' }}>
            Đối soát kết quả chưa rõ
          </Text>
        </Pressable>
      ) : null}
      {recentQueue.length > 0 ? (
        <Notice title="Hàng đợi offline / đồng bộ" tone="default">
          Các mục dưới đây lưu trên máy (SecureStore). Trạng thái máy chủ quyết định
          cho vào — bản thua xung đột không phải lượt vào.
        </Notice>
      ) : null}
      {recentQueue.map((item) => (
        <Text
          key={item.clientEventId}
          selectable
          style={{ color: colors.label, fontSize: 15, lineHeight: 22 }}
        >
          [{item.localStatus}] {item.ticketId.slice(0, 8)}… —{' '}
          {item.lastMessage ?? 'Chờ đồng bộ'}
        </Text>
      ))}
      <View {...supervisorListAnnouncement(SUPERVISOR_NOT_ADMISSION)}>
        <Notice title="Giám sát — thao tác chưa rõ" tone="unknown">
          {SUPERVISOR_NOT_ADMISSION} Các thao tác cổng chưa rõ được lưu ở đây và
          không phải lượt vào.
        </Notice>
        {listUnknownGateOps(ops).length === 0 ? (
          <Text selectable style={{ color: colors.secondary, fontSize: 17 }}>
            Không có thao tác chưa rõ đã lưu.
          </Text>
        ) : (
          listUnknownGateOps(ops).map((op) => (
            <Text
              key={op.id}
              selectable
              {...supervisorUnknownItemAnnouncement({
                label: op.ticketId || op.id,
                message: op.message,
              })}
              style={{ color: colors.label, fontSize: 17, lineHeight: 24 }}
            >
              {op.ticketId || op.id}: {op.message} Không phải lượt vào.
            </Text>
          ))
        )}
      </View>
    </Page>
  );
}
