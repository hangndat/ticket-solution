import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  gateCheckInAnnouncement,
  gateOutcomeAnnouncement,
  gateReconcileAnnouncement,
  supervisorListAnnouncement,
  supervisorUnknownItemAnnouncement,
} from '@/a11y/announcements';
import { BrandWordmark, Notice, Page } from '@/components/page';
import {
  SUPERVISOR_NOT_ADMISSION,
  canReconcile,
  listUnknownGateOps,
  reconcileOp,
  runScan,
  type GateOp,
} from '@/gate/gate-scan';
import { GateCamera } from '@/gate/gate-camera';
import { loadGateOps, saveGateOps } from '@/gate/gate-store';
import { getApiBaseUrl, getEventId, getTenantId } from '@/identity/config';
import { session } from '@/identity/session';
import { colors } from '@/theme/colors';

function outcomeTitle(op: GateOp | null): string {
  if (!op) return 'Chờ mã';
  if (op.phase === 'admitted') return 'Cho vào';
  if (op.phase === 'unknown') return 'Chưa rõ — không cho vào';
  return 'Không cho vào';
}

function outcomeTone(
  phase: GateOp['phase'] | undefined,
): 'admit' | 'deny' | 'unknown' | 'default' {
  if (phase === 'admitted') return 'admit';
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
  const lock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadGateOps().then((loaded) => {
      if (cancelled) return;
      setOps(loaded);
      setCurrent(loaded[0] ?? null);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: GateOp[], active: GateOp | null) => {
    setOps(next);
    setCurrent(active);
    await saveGateOps(next);
  }, []);

  async function submitScan(payload: string = raw) {
    const code = payload.trim();
    if (!code || lock.current) return;
    lock.current = true;
    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    if (!bearer || !apiBase) {
      setCurrent({
        id: 'local',
        ticketId: '',
        tenantId: '',
        eventId: '',
        staffSessionId: '',
        phase: 'denied',
        message: 'Đăng nhập và cấu hình API trước khi quét. Không cho vào.',
      });
      lock.current = false;
      return;
    }
    setBusy(true);
    try {
      const result = await runScan({
        raw: code,
        bearer,
        apiBase,
        ops,
        staffSessionId: sessionId,
        fallback: { tenantId: getTenantId(), eventId: getEventId() },
      });
      setSessionId(result.staffSessionId);
      await persist(result.ops, result.current);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function reconcile() {
    if (!current || !canReconcile(current)) return;
    const bearer = await session.getCredential();
    const apiBase = getApiBaseUrl();
    if (!bearer || !apiBase) return;
    setBusy(true);
    try {
      const next = await reconcileOp({ op: current, bearer, apiBase });
      const rest = ops.filter((op) => op.id !== current.id);
      await persist([next, ...rest], next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <BrandWordmark compact />
      <Notice title="Quét cổng">
        Quét hoặc dán QR hiển thị trên vé. Chỉ cho vào sau khi API ghi nhận
        check-in. Phản hồi mất vẫn giữ “chưa rõ” sau khi mở lại app.
      </Notice>
      <GateCamera disabled={busy || !ready} onScan={(data) => void submitScan(data)} />
      <TextInput
        value={raw}
        onChangeText={setRaw}
        placeholder="Dán JSON QR hoặc ticket id"
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
      <Pressable
        {...gateCheckInAnnouncement()}
        accessibilityState={{ disabled: busy || !ready || raw.trim().length === 0 }}
        disabled={busy || !ready || raw.trim().length === 0}
        onPress={() => void submitScan()}
        style={{
          padding: 14,
          borderRadius: 12,
          backgroundColor: colors.accent,
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
      {current ? (
        <View
          {...gateOutcomeAnnouncement({
            phase: current.phase,
            title: outcomeTitle(current),
            message: current.message,
          })}
          accessibilityLiveRegion={current.phase === 'unknown' ? 'assertive' : 'polite'}
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
