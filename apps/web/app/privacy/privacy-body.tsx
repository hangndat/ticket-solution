import { t } from '../../src/marketing/copy';
import styles from '../account/account-settings.module.css';

/** Product-surface privacy copy (same legal text as marketing, without apex chrome). */
export function ProductPrivacyBody() {
  return (
    <article className={styles.privacyProse} data-testid="privacy-product">
      <p className={styles.privacyUpdated}>{t('vi', 'privacy.updated')}</p>
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
      <p className={styles.privacyUpdated}>{t('vi', 'privacy.note')}</p>
    </article>
  );
}
