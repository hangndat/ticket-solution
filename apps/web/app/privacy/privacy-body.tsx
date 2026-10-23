import { t } from '../../src/marketing/copy';
import {
  accountPrivacyProse,
  accountPrivacyUpdated,
} from '../../src/account/account-flow-surface';

/** Product-surface privacy copy (same legal text as marketing, without apex chrome). */
export function ProductPrivacyBody() {
  return (
    <article className={accountPrivacyProse} data-testid="privacy-product">
      <p className={accountPrivacyUpdated}>{t('vi', 'privacy.updated')}</p>
      <p>{t('vi', 'privacy.intro')}</p>
      <h2>{t('vi', 'privacy.s1.title')}</h2>
      <p>{t('vi', 'privacy.s1.body')}</p>
      <h2>{t('vi', 'privacy.s2.title')}</h2>
      <p>{t('vi', 'privacy.s2.body')}</p>
      <h2>{t('vi', 'privacy.s3.title')}</h2>
      <p>{t('vi', 'privacy.s3.body')}</p>
      <h2>{t('vi', 'privacy.s4.title')}</h2>
      <p>{t('vi', 'privacy.s4.body')}</p>
      <h2>{t('vi', 'privacy.s5.title')}</h2>
      <p>{t('vi', 'privacy.s5.body')}</p>
      <h2>{t('vi', 'privacy.s6.title')}</h2>
      <p>{t('vi', 'privacy.s6.body')}</p>
      <h2>{t('vi', 'privacy.s7.title')}</h2>
      <p>{t('vi', 'privacy.s7.body')}</p>
      <p className={accountPrivacyUpdated}>{t('vi', 'privacy.note')}</p>
    </article>
  );
}
