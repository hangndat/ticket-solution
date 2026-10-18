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
  announcementPhaseFor,
  connectivityLabel,
  presentGateOutcome,
  presentQueueStatus,
  sessionLabel,
  shortId,
} from '@/gate/gate-outcome-copy';
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
import { staffEligibility } from '@/identity/staff-eligibility';
import { colors } from '@/theme/colors';

/** SEC-CACHE: clear Nhân viên chrome immediately after MEMBERSHIP_* / 401/403. */
function clearStaffChromeAfterAuthzDenial() {
  staffEligibility.reset();
  if (session.getSnapshot().status === 'verified') {
    void staffEligibility.refresh(session);
  }
}

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
        'Thiếu địa chỉ API (EXPO_PUBLIC_API_BASE_URL). Không cho vào.',
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
      message: 'Đăng nhập staff (Tài khoản → Đăng nhập) trước khi quét. Không cho vào.',
    };
  }
  return { ok: true, bearer, apiBase };
}

function OutcomeCanvas({
  title,
  detail,
  tone,
  checkinId,
}: {
  title: string;
  detail: string;
  tone: 'admit' | 'deny' | 'unknown' | 'default';
  checkinId?: string;
}) {
  const accent =
    tone === 'admit'
      ? colors.admit
      : tone === 'deny'
        ? colors.deny
        : tone === 'unknown'
          ? colors.unknown
          : colors.separator;

  return (
    <View
      style={{
        minHeight: 168,
        paddingVertical: 28,
        paddingHorizontal: 20,
        gap: 12,
        backgroundColor: colors.card,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderLeftWidth: 6,
        borderLeftColor: accent,
        justifyContent: 'center',
      }}
    >
      <Text
        selectable
        accessibilityRole="header"
        style={{
          color: colors.label,
          fontSize: 34,
          fontWeight: '700',
          letterSpacing: -0.4,
        }}
      >
        {title}
      </Text>
      <Text
        selectable
        style={{ color: colors.secondary, fontSize: 18, lineHeight: 26 }}
      >
        {detail}
      </Text>
      {checkinId ? (
        <Text selectable style={{ color: colors.secondary, fontSize: 15 }}>
          Mã check-in {shortId(checkinId, 12)}
        </Text>
      ) : null}
    </View>
  );
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

  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const verifiedUserId =
    identity.status === 'verified' ? identity.userId : null;

  const refreshConnectivityAndSync = useCallback(async () => {
    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      setConnectivity('unknown');
      return;
    }
    const state = await probeConnectivity(apiBase);
    setConnectivity(state);
    if (state !== 'online') return;
    const snap = session.getSnapshot();
    if (snap.status !== 'verified') return;
    await offlineScanQueue.bindUser(snap.userId);
    const bearer = await session.getCredential();
    if (!bearer) return;
    await offlineScanQueue.replay({ bearer, apiBase });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (verifiedUserId) {
        await offlineScanQueue.bindUser(verifiedUserId);
      } else {
        offlineScanQueue.invalidateMemory();
      }
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
  }, [refreshConnectivityAndSync, verifiedUserId]);

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
      const snap = session.getSnapshot();
      if (snap.status !== 'verified') {
        setCurrent({
          id: 'local',
          ticketId: '',
          tenantId: '',
          eventId: '',
          staffSessionId: '',
          phase: 'denied',
          message:
            'Phiên staff chưa xác minh — đăng nhập lại trước khi quét. Không cho vào.',
        });
        return;
      }
      await offlineScanQueue.bindUser(snap.userId);
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
      if (result.membershipAuthzDenied) {
        clearStaffChromeAfterAuthzDenial();
      }

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
        void offlineScanQueue.replay({
          bearer: auth.bearer,
          apiBase: auth.apiBase,
        });
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
      const reconciled = await reconcileOp({
        op: current,
        bearer: auth.bearer,
        apiBase: auth.apiBase,
      });
      if (reconciled.membershipAuthzDenied) {
        clearStaffChromeAfterAuthzDenial();
      }
      const next = reconciled.op;
      const rest = ops.filter((op) => op.id !== current.id);
      await persist([next, ...rest], next);
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    const auth = await resolveGateAuth();
    if (!auth.ok) return;
    const snap = session.getSnapshot();
    if (snap.status !== 'verified') return;
    setBusy(true);
    try {
      await offlineScanQueue.bindUser(snap.userId);
      setConnectivity(await probeConnectivity(auth.apiBase));
      await offlineScanQueue.replay({
        bearer: auth.bearer,
        apiBase: auth.apiBase,
      });
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
  const outcome = presentGateOutcome(busy ? null : current);
  const outcomeView = busy
    ? {
        kind: 'confirming' as const,
        title: scanCopy.checking.title,
        detail: scanCopy.checking.body,
        tone: 'default' as const,
        assertive: false,
      }
    : outcome;

  const eventId = getEventId();
  const tenantId = getTenantId();
  const gateSessionLabel = sessionId
    ? `Phiên cổng ${shortId(sessionId)}`
    : 'Chưa mở phiên cổng';

  return (
    <Page>
      <BrandWordmark compact />

      <Notice title={banner.title} tone={banner.tone}>
        {banner.body}
      </Notice>

      <View
        accessibilityRole="summary"
        accessibilityLabel={`${scanCopy.contextHint.title}. ${connectivityLabel(connectivity)}. ${sessionLabel(identity.status)}. ${gateSessionLabel}.`}
        style={{
          padding: 16,
          gap: 6,
          backgroundColor: colors.card,
          borderRadius: 14,
          borderCurve: 'continuous',
        }}
      >
        <Text style={{ color: colors.secondary, fontSize: 13, fontWeight: '600' }}>
          {scanCopy.contextHint.title}
        </Text>
        <Text style={{ color: colors.label, fontSize: 17, fontWeight: '600' }}>
          Sự kiện {shortId(eventId)} · Tổ chức {shortId(tenantId)}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 22 }}>
          {connectivityLabel(connectivity)} · {sessionLabel(identity.status)}
          {'\n'}
          {gateSessionLabel}
          {sessionId ? '' : ' (cần online một lần trước khi xếp hàng offline)'}
        </Text>
      </View>

      {!ready ? (
        <LoadingState title={scanCopy.loadingStore.title}>
          {scanCopy.loadingStore.body}
        </LoadingState>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.secondary, fontSize: 13, fontWeight: '600' }}>
          Vùng quét
        </Text>
        <GateCamera disabled={busy || !ready} onScan={(data) => void submitScan(data)} />
        <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 22 }}>
          Đưa mã QR vào khung hoặc dán mã bên dưới. Khi ngoại tuyến: xếp hàng trên
          máy — chưa cho vào; không cam kết chống trùng giữa nhiều thiết bị trước
          khi đồng bộ.
        </Text>
      </View>

      <TextInput
        testID="gate-scan-input"
        value={raw}
        onChangeText={setRaw}
        placeholder="Dán JSON QR hoặc mã vé"
        accessibilityLabel="Mã vé hoặc JSON QR"
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
          minHeight: 48,
          padding: 14,
          borderRadius: 12,
          backgroundColor: colors.accent,
          borderWidth: checkInFocused ? 2 : 0,
          borderColor: colors.focus,
          justifyContent: 'center',
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

      <View
        {...gateOutcomeAnnouncement({
          phase: announcementPhaseFor(
            busy ? 'confirming' : current?.phase,
          ),
          title: outcomeView.title,
          message: outcomeView.detail,
        })}
        accessibilityLiveRegion={outcomeView.assertive ? 'assertive' : 'polite'}
      >
        {!busy && ready && !current ? (
          <EmptyState title={scanCopy.idle.title}>{scanCopy.idle.body}</EmptyState>
        ) : (
          <OutcomeCanvas
            title={outcomeView.title}
            detail={outcomeView.detail}
            tone={outcomeView.tone}
            checkinId={busy ? undefined : current?.checkinId}
          />
        )}
      </View>

      {queueSnap.pendingCount > 0 || queueSnap.conflictCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đồng bộ hàng đợi offline"
          accessibilityState={{ disabled: busy || queueSnap.syncing }}
          disabled={busy || queueSnap.syncing}
          onPress={() => void syncNow()}
          style={{
            minHeight: 48,
            padding: 14,
            borderRadius: 12,
            backgroundColor: colors.card,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.label, fontSize: 17, textAlign: 'center' }}>
            {queueSnap.syncing ? 'Đang đồng bộ…' : 'Đồng bộ hàng đợi ngay'}
          </Text>
        </Pressable>
      ) : null}

      {current && canReconcile(current) ? (
        <Pressable
          {...gateReconcileAnnouncement()}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void reconcile()}
          style={{
            minHeight: 48,
            padding: 14,
            borderRadius: 12,
            backgroundColor: colors.card,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.label, fontSize: 17, textAlign: 'center' }}>
            Đối soát kết quả chưa rõ
          </Text>
        </Pressable>
      ) : null}

      {recentQueue.length > 0 ? (
        <View style={{ gap: 12 }}>
          <Notice title="Hàng đợi đồng bộ" tone="default">
            Mục lưu trên máy. Trạng thái máy chủ quyết định cho vào —
            DUPLICATE / CONFLICT / REJECTED không phải lượt vào mới.
          </Notice>
          {recentQueue.map((item) => {
            const statusView = presentQueueStatus(item.localStatus);
            const accent =
              statusView.tone === 'admit'
                ? colors.admit
                : statusView.tone === 'deny'
                  ? colors.deny
                  : statusView.tone === 'unknown'
                    ? colors.unknown
                    : colors.separator;
            return (
              <View
                key={item.clientEventId}
                accessibilityRole="text"
                accessibilityLabel={`${statusView.label}. ${statusView.detail}. Vé ${shortId(item.ticketId)}.`}
                style={{
                  padding: 14,
                  gap: 6,
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  borderLeftWidth: 4,
                  borderLeftColor: accent,
                }}
              >
                <Text style={{ color: colors.label, fontSize: 17, fontWeight: '600' }}>
                  [{statusView.serverToken}] {statusView.label}
                </Text>
                <Text selectable style={{ color: colors.secondary, fontSize: 15, lineHeight: 22 }}>
                  Vé {shortId(item.ticketId)} — {item.lastMessage ?? statusView.detail}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

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
              {shortId(op.ticketId || op.id)}: {op.message} Không phải lượt vào.
            </Text>
          ))
        )}
      </View>

      <Text selectable style={{ color: colors.secondary, fontSize: 13, lineHeight: 18 }}>
        Chi tiết kỹ thuật: API {getApiBaseUrl() ?? 'chưa cấu hình'} · phiên app{' '}
        {identity.status}
      </Text>
    </Page>
  );
}
