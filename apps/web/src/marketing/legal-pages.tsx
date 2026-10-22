import { Button } from '@ticket/ui';
import Link from 'next/link';
import { t } from './copy';
import { MarketingChrome } from './chrome';
import {
  loginHref,
  productOriginFromEnv,
  redeemHref,
  type MarketingLocale,
} from './hosts';
import { salesHref } from './links';

export function PrivacyPage({ locale }: { locale: MarketingLocale }) {
  return (
    <MarketingChrome locale={locale} pageKind="privacy">
      <main id="main" className="mkt-legal" data-testid={`privacy-${locale}`}>
        <div className="mkt-wrap">
        <h1>{t(locale, 'privacy.title')}</h1>
        <p className="mkt-lead">{t(locale, 'privacy.updated')}</p>
        <p>{t(locale, 'privacy.intro')}</p>
        <h2>{t(locale, 'privacy.s1.title')}</h2>
        <p>{t(locale, 'privacy.s1.body')}</p>
        <h2>{t(locale, 'privacy.s2.title')}</h2>
        <p>{t(locale, 'privacy.s2.body')}</p>
        <h2>{t(locale, 'privacy.s3.title')}</h2>
        <p>{t(locale, 'privacy.s3.body')}</p>
        <h2>{t(locale, 'privacy.s4.title')}</h2>
        <p>{t(locale, 'privacy.s4.body')}</p>
        <h2>{t(locale, 'privacy.s5.title')}</h2>
        <p>{t(locale, 'privacy.s5.body')}</p>
        <h2>{t(locale, 'privacy.s6.title')}</h2>
        <p>{t(locale, 'privacy.s6.body')}</p>
        <h2>{t(locale, 'privacy.s7.title')}</h2>
        <p>{t(locale, 'privacy.s7.body')}</p>
        <p className="mkt-lead">{t(locale, 'privacy.note')}</p>
        </div>
      </main>
    </MarketingChrome>
  );
}

export function SupportPage({ locale }: { locale: MarketingLocale }) {
  const productOrigin = productOriginFromEnv();
  const login = loginHref(productOrigin);
  const redeem = redeemHref(productOrigin);
  const email = t(locale, 'support.email.value');

  return (
    <MarketingChrome locale={locale} pageKind="support">
      <main id="main" className="mkt-legal" data-testid={`support-${locale}`}>
        <div className="mkt-wrap">
        <h1>{t(locale, 'support.title')}</h1>
        <p className="mkt-lead">{t(locale, 'support.lead')}</p>
        <p>
          <strong>{t(locale, 'support.email.label')}: </strong>
          <a href={`mailto:${email}`}>{email}</a>
        </p>
        <p>{t(locale, 'support.sla')}</p>
        <p className="mt-7 flex flex-wrap items-center gap-3">
          <Button asChild variant="primary">
            <a href={login}>{t(locale, 'support.app')}</a>
          </Button>
          <Button asChild variant="secondary">
            <Link href={salesHref(locale)}>{t(locale, 'support.sales')}</Link>
          </Button>
        </p>
        <p>
          <a href={redeem}>{t(locale, 'support.guest')}</a>
        </p>
        </div>
      </main>
    </MarketingChrome>
  );
}
