'use client';

import { Button, Space } from 'antd';
import { usePortalLocale } from '../i18n';

type SetupPage = 'types' | 'sources' | 'quota';

export function EventSetupNav({
  tenantId,
  eventId,
  current,
}: {
  tenantId: string;
  eventId: string;
  current: SetupPage;
}) {
  const { t } = usePortalLocale();
  const pages = [
    { key: 'types', label: t('nav.event.types') },
    { key: 'sources', label: t('nav.event.sources') },
    { key: 'quota', label: t('nav.event.quota') },
  ] as const;

  return (
    <nav aria-label={t('event.setupNavigation')} style={{ marginBottom: 16 }}>
      <Space wrap>
        {pages.map(({ key, label }) => (
          <Button
            key={key}
            href={`/t/${tenantId}/e/${eventId}/${key}`}
            aria-current={current === key ? 'page' : undefined}
            type={current === key ? 'primary' : 'default'}
          >
            {label}
          </Button>
        ))}
      </Space>
    </nav>
  );
}
