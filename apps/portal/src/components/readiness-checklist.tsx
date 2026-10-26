'use client';

import type { PrepReadinessItem } from '../prep/readiness';
import { formatReadinessStatus, usePortalLocale } from '../i18n';

function readinessMark(status: PrepReadinessItem['status']): string {
  switch (status) {
    case 'ok':
      return '✓';
    case 'missing':
      return '!';
    case 'forbidden':
      return '×';
    default:
      return '◷';
  }
}

export type ReadinessChecklistProps = {
  title: string;
  summary: string;
  items: PrepReadinessItem[];
};

/** VD-07 checklist visual aligned with design-system/product/portal.html */
export function ReadinessChecklist({
  title,
  summary,
  items,
}: ReadinessChecklistProps) {
  const { locale } = usePortalLocale();

  return (
    <div className="portal-readiness" data-testid="portal-readiness-checklist">
      <h3 className="portal-readiness__title">{title}</h3>
      <p className="portal-readiness__summary">{summary}</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li
            key={item.key}
            className={`portal-ready-item portal-ready-item--${item.status}`}
          >
            <span className="portal-ready-item__mark" aria-hidden>
              {readinessMark(item.status)}
            </span>
            <div className="portal-ready-item__body">
              <strong>
                {item.label} — {formatReadinessStatus(locale, item.status)}
              </strong>
              <span>{item.detail}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
