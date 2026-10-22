'use client';

import { Alert } from 'antd';
import { isPortalDualRunBannerEnabled } from '../dual-run/allowlist';
import { usePortalLocale } from '../i18n';

/**
 * Portal-side dual-run notice — legacy admin still on product origin until
 * an authorized deploy switches traffic (ADR-20 §8).
 */
export function PortalDualRunBanner({
  productOrigin,
}: {
  productOrigin: string;
}) {
  const { t } = usePortalLocale();
  if (!isPortalDualRunBannerEnabled()) return null;
  const product = productOrigin;
  const legacyAdmin = `${product}/admin`;

  return (
    <Alert
      type="info"
      showIcon
      banner
      data-testid="portal-dual-run-banner"
      style={{ marginBottom: 16 }}
      message={t('dualRun.h_ekkubx')}
      description={
        <>
          {t('dualRun.h_16lfg67_2')}
          <a href={legacyAdmin} rel="noopener noreferrer">
            {legacyAdmin}
          </a>
          {t('dualRun.h_l9n5m3')}
        </>
      }
    />
  );
}
