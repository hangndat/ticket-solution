'use client';

import { Alert } from 'antd';
import {
  isPortalDualRunBannerEnabled,
  productOriginFromEnv,
} from '../dual-run/allowlist';

/**
 * Portal-side dual-run notice — legacy admin still on product origin until
 * an authorized deploy switches traffic (ADR-20 §8).
 */
export function PortalDualRunBanner() {
  if (!isPortalDualRunBannerEnabled()) return null;
  const product = productOriginFromEnv();
  const legacyAdmin = `${product}/admin`;

  return (
    <Alert
      type="info"
      showIcon
      banner
      data-testid="portal-dual-run-banner"
      style={{ marginBottom: 16 }}
      message="Chế độ dual-run (local / prep)"
      description={
        <>
          Portal và legacy admin trên app đang chạy song song. Redirect
          app→portal mặc định tắt. Cổng quét giữ trên app (
          <a href={`${product}/gate`} rel="noopener noreferrer">
            {product}/gate
          </a>
          ). Legacy:{' '}
          <a href={legacyAdmin} rel="noopener noreferrer">
            {legacyAdmin}
          </a>
          . Không DNS/deploy prod từ banner này.
        </>
      }
    />
  );
}
