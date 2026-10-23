import type { Metadata } from 'next';
import Link from 'next/link';
import { accountBackLink } from '../../src/account/account-flow-surface';
import { AccountShell } from '../account/account-shell';
import { ProductPrivacyBody } from './privacy-body';
import { t } from '../../src/marketing/copy';

export const metadata: Metadata = {
  title: t('vi', 'privacy.title'),
  description: t('vi', 'privacy.intro'),
  robots: { index: true, follow: true },
};

export default function ProductPrivacyPage() {
  return (
    <AccountShell
      active="privacy"
      title={t('vi', 'privacy.title')}
      lead="Chính sách quyền riêng tư và xử lý dữ liệu trên Vemoki — đọc ngay trên website sản phẩm."
    >
      <ProductPrivacyBody />
      <p className={accountBackLink}>
        <Link href="/account">← Quay lại Tài khoản</Link>
      </p>
    </AccountShell>
  );
}
