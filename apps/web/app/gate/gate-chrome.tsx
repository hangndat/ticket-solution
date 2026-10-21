'use client';

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
    <nav className="gate-tabs" aria-label="Chế độ cổng" data-testid="gate-tabs">
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
            className={selected ? 'gate-tabs__btn gate-tabs__btn--active' : 'gate-tabs__btn'}
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
};

export function GateScopeBar({ eventId, tenantId, link, hasSession }: ScopeBarProps) {
  const scopeLabel = eventId.trim()
    ? `Sự kiện · ${shortId(eventId)}`
    : tenantId.trim()
      ? `Tenant · ${shortId(tenantId)}`
      : 'Chưa chọn phạm vi';
  const gateName = hasSession ? 'Phiên đang mở' : 'Cổng web';
  const status =
    link === 'online' ? 'Sẵn sàng' : connectivityLabel(link);
  const statusClass =
    link === 'online'
      ? 'gatebar__status gatebar__status--ready'
      : link === 'offline'
        ? 'gatebar__status gatebar__status--offline'
        : 'gatebar__status gatebar__status--degraded';

  return (
    <div className="gatebar" data-testid="gate-bar">
      <p className="gatebar__scope">
        <strong>{scopeLabel}</strong>
        <span className="gatebar__gate-name"> · {gateName}</span>
      </p>
      <p className={statusClass}>
        <span className="gatebar__dot" aria-hidden="true" />
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
