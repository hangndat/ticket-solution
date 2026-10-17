import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import type { TicketSummary } from '@ticket/contracts';
import { BrandWordmark, Notice, Page } from '@/components/page';
import { QrCode } from '@/components/qr-code';
import { brand, colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { getTenantId } from '@/identity/config';
import { session } from '@/identity/session';
import { buildDisplayQrPayload } from '@/tickets/display-payload';
import { readTicketDisplayCache } from '@/tickets/display-cache';
import { offlineDisplay } from '@/tickets/offline-display-session';

type LoadOwner = {
  ownerUserId: string;
  ownerTenantId: string;
  ticketId: string;
  mode: 'verified' | 'offline-display';
};

type LoadState =
  | { status: 'idle' }
  | (LoadOwner & {
      status: 'ready';
      ticket: TicketSummary;
      syncedAt: string | null;
      fromCache: boolean;
    })
  | (LoadOwner & { status: 'missing' });

function loadMatchesOwner(
  load: LoadState,
  owner: LoadOwner | null,
): load is Extract<LoadState, { status: 'ready' | 'missing' }> {
  if (!owner || (load.status !== 'ready' && load.status !== 'missing')) {
    return false;
  }
  return (
    load.ownerUserId === owner.ownerUserId &&
    load.ownerTenantId === owner.ownerTenantId &&
    load.ticketId === owner.ticketId &&
    load.mode === owner.mode
  );
}

export function TicketDetailScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
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
  const envTenantId = getTenantId();
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  const verifiedUserId =
    identity.status === 'verified' ? identity.userId : null;
  const offlineUserId = offline.status === 'bound' ? offline.userId : null;
  const offlineTenantId = offline.status === 'bound' ? offline.tenantId : null;

  const displayUserId = verifiedUserId ?? offlineUserId;
  const displayTenantId =
    (verifiedUserId ? envTenantId : null) ?? offlineTenantId;
  const displayMode: 'verified' | 'offline-display' | null = verifiedUserId
    ? 'verified'
    : offlineUserId
      ? 'offline-display'
      : null;

  const owner = useMemo<LoadOwner | null>(() => {
    if (!displayUserId || !displayTenantId || !ticketId || !displayMode) {
      return null;
    }
    return {
      ownerUserId: displayUserId,
      ownerTenantId: displayTenantId,
      ticketId,
      mode: displayMode,
    };
  }, [displayMode, displayTenantId, displayUserId, ticketId]);

  // Refuse stale ready state immediately on identity switch — do not wait for
  // useEffect to clear, or one frame can render account A's QR under B.
  const visibleLoad = useMemo<LoadState>(
    () => (loadMatchesOwner(load, owner) ? load : { status: 'idle' }),
    [load, owner],
  );

  useEffect(() => {
    if (!displayUserId || !displayTenantId || !ticketId || !displayMode) {
      return;
    }
    const ownerUserId = displayUserId;
    const ownerTenantId = displayTenantId;
    const id = ticketId;
    const mode = displayMode;
    let cancelled = false;
    void (async () => {
      if (mode === 'verified') {
        const memory = session.read<TicketSummary[]>(ownerTenantId, 'me-tickets');
        const fromMemory = memory?.find((t) => t.ticketId === id) ?? null;
        if (fromMemory) {
          if (!cancelled) {
            setLoad({
              status: 'ready',
              ticket: fromMemory,
              syncedAt: new Date().toISOString(),
              fromCache: false,
              ownerUserId,
              ownerTenantId,
              ticketId: id,
              mode,
            });
          }
          return;
        }
      }
      const cache = await readTicketDisplayCache(ownerUserId, ownerTenantId);
      const found = cache?.tickets.find((t) => t.ticketId === id) ?? null;
      if (cancelled) return;
      if (found) {
        setLoad({
          status: 'ready',
          ticket: found,
          syncedAt: cache?.syncedAt ?? null,
          fromCache: true,
          ownerUserId,
          ownerTenantId,
          ticketId: id,
          mode,
        });
      } else {
        setLoad({
          status: 'missing',
          ownerUserId,
          ownerTenantId,
          ticketId: id,
          mode,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayMode, displayTenantId, displayUserId, ticketId]);

  const qrValue = useMemo(
    () =>
      visibleLoad.status === 'ready'
        ? buildDisplayQrPayload(visibleLoad.ticket)
        : '',
    [visibleLoad],
  );

  if (!displayMode || !owner) {
    return (
      <Page>
        <Notice title="Cần đăng nhập">
          Chi tiết vé cần phiên đã xác minh hoặc liên kết hiển thị offline trên
          thiết bị này.
        </Notice>
      </Page>
    );
  }

  if (visibleLoad.status === 'idle') {
    return (
      <Page>
        <Notice title="Đang tải vé">
          Đọc bộ nhớ phiên hoặc bộ đệm hiển thị offline…
        </Notice>
      </Page>
    );
  }

  if (visibleLoad.status === 'missing') {
    return (
      <Page>
        <Notice title="Không tìm thấy vé">
          Không có vé khớp id này cho danh tính hiện tại. Kéo để làm mới Vé của
          tôi khi online.
        </Notice>
      </Page>
    );
  }

  const { ticket, syncedAt, fromCache, mode } = visibleLoad;

  return (
    <Page>
      <View
        style={{
          backgroundColor: colors.ticketCanvas,
          borderRadius: 20,
          borderCurve: 'continuous',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: brand.signal,
        }}
      >
        <View
          style={{
            height: 6,
            backgroundColor: brand.signal,
          }}
        />
        <View style={{ padding: 20, gap: 16, alignItems: 'center' }}>
          <BrandWordmark compact />
          <Text
            style={{
              color: brand.ink,
              ...typography.display,
              textAlign: 'center',
            }}
          >
            Vé của bạn
          </Text>
          <Text
            selectable
            style={{
              color: brand.ink,
              ...typography.callout,
              textAlign: 'center',
            }}
          >
            {ticket.state} · v{ticket.credentialVersion}
          </Text>
          {qrValue ? (
            <QrCode
              value={qrValue}
              inkColor={brand.ink}
              paperColor="#ffffff"
            />
          ) : null}
          <Text
            selectable
            style={{
              color: colors.secondary,
              ...typography.caption,
              textAlign: 'center',
            }}
          >
            {ticket.ticketId}
          </Text>
          <Text
            style={{
              color: colors.secondary,
              fontSize: 15,
              lineHeight: 22,
              textAlign: 'center',
            }}
          >
            Chỉ hiển thị TicketSummary — không phải credential Gate đã ký và
            không phải check-in offline. Máy chủ vẫn quyết định thu hồi/đã dùng.
          </Text>
        </View>
      </View>

      <Notice title="Thông tin vé">
        Sự kiện: {ticket.eventId}
        {'\n'}
        Loại: {ticket.ticketTypeId}
        {'\n'}
        Tạo lúc: {ticket.createdAt}
      </Notice>

      <Notice title="Đồng bộ">
        {mode === 'offline-display'
          ? 'Chế độ: hiển thị offline (chưa xác minh SessionBoundary)'
          : fromCache
            ? 'Nguồn: bộ đệm hiển thị offline'
            : 'Nguồn: bộ nhớ phiên / lần tải gần nhất'}
        {'\n'}
        Đồng bộ lần cuối: {syncedAt ?? 'không rõ'}
        {'\n'}
        Trạng thái có thể đã đổi kể từ lần đồng bộ.
      </Notice>
    </Page>
  );
}
