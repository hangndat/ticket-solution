'use client';

import type { ReadinessItem } from '../../src/admin/readiness';
import type { EventListView } from '../../src/admin/create-event';

type Props = {
  eventList: EventListView | null;
  readinessItems: ReadinessItem[];
  tenantLabel: string;
  hasEventContext: boolean;
};

function readinessOkCount(items: ReadinessItem[]): number {
  return items.filter((i) => i.status === 'ok').length;
}

export function AdminStatsBar({
  eventList,
  readinessItems,
  tenantLabel,
  hasEventContext,
}: Props) {
  const eventCount =
    eventList?.kind === 'list'
      ? String(eventList.items.length)
      : hasEventContext
        ? '1'
        : '—';
  const ready = readinessOkCount(readinessItems);
  const readyTotal = readinessItems.length;

  return (
    <div
      className="admin-stats"
      role="region"
      aria-label="Tổng quan nhanh"
      data-testid="admin-stats"
    >
      <div className="admin-stat">
        <span className="admin-stat__label">Sự kiện trong tổ chức</span>
        <strong className="admin-stat__value">{eventCount}</strong>
        <span className="admin-stat__hint muted">
          Liệt kê event để cập nhật số thực tế
        </span>
      </div>
      <div className="admin-stat">
        <span className="admin-stat__label">Chuẩn bị xuất bản</span>
        <strong className="admin-stat__value">
          {readyTotal > 0 ? `${ready}/${readyTotal}` : '—'}
        </strong>
        <span className="admin-stat__hint muted">
          Mục checklist đã đủ điều kiện
        </span>
      </div>
      <div className="admin-stat">
        <span className="admin-stat__label">Tổ chức</span>
        <strong className="admin-stat__value admin-stat__value--text">
          {tenantLabel}
        </strong>
        <span className="admin-stat__hint muted">Ngữ cảnh quản trị hiện tại</span>
      </div>
    </div>
  );
}
