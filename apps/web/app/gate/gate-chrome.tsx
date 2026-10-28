'use client';

import { cn } from '../../lib/utils';
import type { GateLinkState } from '../../src/gate/connectivity';
import { connectivityLabel, shortId } from '../../src/gate/gate-outcome-copy';

export type GateTab = 'scan' | 'manual' | 'history';

const TAB_ORDER: GateTab[] = ['scan', 'manual', 'history'];

const TAB_LABELS: Record<GateTab, string> = {
  scan: 'Quét vé',
  manual: 'Nhập tay',
  history: 'Lịch sử',
};

type TabNavProps = {
  active: GateTab;
  onChange: (tab: GateTab) => void;
};

export function GateTabNav({ active, onChange }: TabNavProps) {
  return (
    <nav
      className="mt-6 flex flex-wrap gap-2 border-b border-line pb-0"
      aria-label="Chế độ cổng"
      data-testid="gate-tabs"
    >
      {TAB_ORDER.map((tab) => {
        const selected = active === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`gate-tab-${tab}`}
            aria-selected={selected}
            aria-controls={`gate-panel-${tab}`}
            tabIndex={selected ? 0 : -1}
            className={cn(
              'inline-flex min-h-11 items-center rounded-t-md px-4 text-sm font-semibold transition-colors',
              selected
                ? 'border border-b-0 border-line bg-white text-ink shadow-[inset_0_-2px_0_var(--color-signal)]'
                : 'text-muted hover:bg-ink/[0.04] hover:text-ink',
            )}
            onClick={() => onChange(tab)}
            data-testid={`gate-tab-${tab}`}
          >
            {TAB_LABELS[tab]}
          </button>
        );
      })}
    </nav>
  );
}

type ScopeBarProps = {
  eventId: string;
  tenantId: string;
  link: GateLinkState;
  hasSession: boolean;
  /** Human event name from MeEvents when staff is assigned (mockup «MFest»). */
  eventDisplayName?: string | null;
  /** Gate label when scoped; defaults to «Cổng chính» per mockup. */
  gateDisplayName?: string | null;
};

export function GateScopeBar({
  eventId,
  tenantId,
  link,
  hasSession,
  eventDisplayName,
  gateDisplayName,
}: ScopeBarProps) {
  const eventName = eventDisplayName?.trim();
  const scopedByDiscovery = Boolean(eventName);
  const scopeLabel = scopedByDiscovery
    ? eventName!
    : eventId.trim()
      ? `Sự kiện · ${shortId(eventId)}`
      : tenantId.trim()
        ? `Tenant · ${shortId(tenantId)}`
        : 'Chưa chọn phạm vi';
  const gateName = hasSession
    ? 'Phiên đang mở'
    : scopedByDiscovery
      ? (gateDisplayName?.trim() || 'Cổng chính')
      : 'Cổng web';
  const status = link === 'online' ? 'Sẵn sàng' : connectivityLabel(link);
  const statusClass =
    link === 'online'
      ? 'text-admit'
      : link === 'offline'
        ? 'text-destructive'
        : 'text-[color-mix(in_srgb,var(--color-focus)_70%,var(--color-ink))]';

  return (
    <div
      className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-white px-4 py-3"
      data-testid="gate-bar"
    >
      <p className="m-0 text-sm text-ink">
        <strong>{scopeLabel}</strong>
        <span className="text-muted"> · {gateName}</span>
      </p>
      <p className={cn('m-0 inline-flex items-center gap-2 text-sm font-semibold', statusClass)}>
        <span
          className={cn(
            'inline-block size-2.5 rounded-full',
            link === 'online'
              ? 'bg-admit'
              : link === 'offline'
                ? 'bg-destructive'
                : 'bg-focus',
          )}
          aria-hidden="true"
        />
        {status}
      </p>
    </div>
  );
}

export function gateTabTitle(tab: GateTab): { title: string; lead: string } {
  switch (tab) {
    case 'scan':
      return {
        title: 'Quét vé',
        lead: 'Đưa mã QR vào khung để kiểm tra. Chưa có camera thì chuyển sang Nhập tay.',
      };
    case 'manual':
      return {
        title: 'Nhập tay',
        lead: 'Mở phiên cổng, nhập mã vé và xác nhận qua API. Không cho qua khi kết quả chưa rõ.',
      };
    case 'history':
      return {
        title: 'Lịch sử quét',
        lead: 'Các lượt check-in đã ghi trên trình duyệt này. Không phải toàn hệ thống.',
      };
    default:
      return { title: 'Cổng check-in', lead: '' };
  }
}
