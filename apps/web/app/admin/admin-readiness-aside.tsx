'use client';

import {
  readinessSummary,
  type ReadinessItem,
} from '../../src/admin/readiness';

type Props = {
  items: ReadinessItem[];
};

export function AdminReadinessAside({ items }: Props) {
  return (
    <aside
      className="admin-readiness"
      aria-labelledby="admin-ready-title"
      data-testid="admin-readiness"
    >
      <h2 id="admin-ready-title">Sẵn sàng xuất bản</h2>
      <ul className="admin-readiness__list">
        {items.map((item) => (
          <li
            key={item.key}
            data-key={item.key}
            data-status={item.status}
            data-testid={`admin-ready-${item.key}`}
          >
            <span className="admin-readiness__mark" aria-hidden="true">
              {item.status === 'ok'
                ? '✓'
                : item.status === 'missing'
                  ? '!'
                  : '?'}
            </span>
            <span>
              <strong>{item.label}</strong>
              <span className="muted"> — {item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <p
        className="muted"
        data-testid="admin-readiness-summary"
        role="status"
      >
        {readinessSummary(items)}
      </p>
    </aside>
  );
}
