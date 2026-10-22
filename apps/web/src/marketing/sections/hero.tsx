import { Button, ProductPreviewFrame } from '@ticket/ui';
import Link from 'next/link';
import { t } from '../copy';
import type { MarketingSectionProps } from './types';

function previewLabels(locale: MarketingSectionProps['locale']) {
  return {
    tabsLabel: t(locale, 'hero.preview.tabs_label'),
    tabWallet: t(locale, 'hero.preview.tab.wallet'),
    tabGate: t(locale, 'hero.preview.tab.gate'),
    urlWallet: t(locale, 'hero.preview.url.wallet'),
    urlGate: t(locale, 'hero.preview.url.gate'),
    caption: t(locale, 'hero.preview.caption'),
    demoPill: t(locale, 'badge.demo'),
    navWallet: t(locale, 'hero.preview.nav.wallet'),
    navGate: t(locale, 'hero.preview.nav.gate'),
    walletTitle: t(locale, 'hero.preview.wallet.title'),
    walletSub: t(locale, 'hero.preview.wallet.sub'),
    ticketUnused: t(locale, 'hero.preview.ticket.unused'),
    eventRiver: t(locale, 'hero.preview.event.river'),
    gateHint: t(locale, 'hero.preview.gate.hint'),
    gateOk: t(locale, 'hero.preview.gate.ok'),
    gateDup: t(locale, 'hero.preview.gate.dup'),
    gateEvent: t(locale, 'hero.preview.gate.event'),
    phoneMeta: t(locale, 'hero.preview.phone.meta'),
  };
}

export function HeroSection({ locale, demo, login }: MarketingSectionProps) {
  return (
    <section
      id="top"
      className="mkt-section mkt-section--ink mkt-hero"
      aria-labelledby="hero-title"
      data-analytics-section="hero"
    >
      <div className="mkt-wrap mkt-hero-grid">
        <div className="mkt-hero-copy">
          <p className="mkt-eyebrow">{t(locale, 'hero.eyebrow')}</p>
          <h1 id="hero-title" className="mkt-display mkt-h1" data-testid="hero-headline">
            {t(locale, 'hero.headline')}
          </h1>
          <p className="mkt-lead">{t(locale, 'hero.sub')}</p>
          <ul className="mkt-hero-points" aria-label={t(locale, 'hero.proofs.label')}>
            <li>{t(locale, 'hero.proof1')}</li>
            <li>{t(locale, 'hero.proof2')}</li>
            <li>{t(locale, 'hero.proof3')}</li>
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild variant="primary" data-testid="cta-demo" data-analytics-cta="hero_demo">
              <a href={demo}>{t(locale, 'hero.cta.demo')}</a>
            </Button>
            <Button
              asChild
              variant="secondaryOnInk"
              data-testid="cta-interest"
              data-analytics-cta="hero_interest"
            >
              <Link href="#interest">{t(locale, 'hero.cta.interest')}</Link>
            </Button>
            <Button asChild variant="ghostOnInk" data-testid="cta-login" data-analytics-cta="hero_login">
              <a href={login}>{t(locale, 'hero.cta.login')}</a>
            </Button>
          </div>
          <p className="mkt-demo-note" role="status" data-testid="demo-badge">
            {t(locale, 'hero.demo_note')}
          </p>
        </div>
        <ProductPreviewFrame labels={previewLabels(locale)} />
      </div>
      <div className="mkt-marquee" aria-hidden="true">
        <div className="mkt-marquee-track">
          <span>{t(locale, 'hero.marquee')}</span>
          <span>{t(locale, 'hero.marquee')}</span>
        </div>
      </div>
    </section>
  );
}
