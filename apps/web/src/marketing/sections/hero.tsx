import Image from 'next/image';
import Link from 'next/link';
import { HERO_PREVIEW } from '../content-config';
import { t } from '../copy';
import type { MarketingSectionProps } from './types';

export function HeroSection({ locale, demo, login }: MarketingSectionProps) {
  const alt = t(locale, 'hero.preview.alt');
  const caption = t(locale, 'hero.preview.caption');

  return (
    <header
      className="mkt-hero mkt-hero-grid"
      id="top"
      data-analytics-section="hero"
    >
      <div className="mkt-hero-copy">
        <p className="mkt-eyebrow">{t(locale, 'hero.eyebrow')}</p>
        <p className="mkt-hero-brand" data-testid="hero-brand">
          vemoki<span aria-hidden="true">↗</span>
        </p>
        <h1>{t(locale, 'hero.headline')}</h1>
        <p className="mkt-support">{t(locale, 'hero.sub')}</p>
        <ul className="mkt-hero-proofs" aria-label={t(locale, 'hero.proofs.label')}>
          <li>{t(locale, 'hero.proof1')}</li>
          <li>{t(locale, 'hero.proof2')}</li>
          <li>{t(locale, 'hero.proof3')}</li>
        </ul>
        <div className="mkt-cta-row">
          <a
            className="mkt-btn mkt-btn-primary"
            href={demo}
            data-testid="cta-demo"
            data-analytics-cta="hero_demo"
          >
            {t(locale, 'hero.cta.demo')}
          </a>
          <Link
            className="mkt-btn mkt-btn-primary"
            href="#interest"
            data-testid="cta-interest"
            data-analytics-cta="hero_interest"
          >
            {t(locale, 'hero.cta.interest')}
          </Link>
          <a
            className="mkt-btn-ghost"
            href={login}
            data-testid="cta-login"
            data-analytics-cta="hero_login"
          >
            {t(locale, 'hero.cta.login')}
          </a>
        </div>
        <p className="mkt-hero-note" role="status" data-testid="demo-badge">
          {t(locale, 'hero.demo_note')}
        </p>
      </div>
      <figure className="mkt-hero-preview">
        <div className="mkt-hero-preview-frame">
          <Image
            className="mkt-hero-preview-img mkt-hero-preview-desktop"
            src={HERO_PREVIEW.desktop.src}
            alt={alt}
            width={HERO_PREVIEW.desktop.width}
            height={HERO_PREVIEW.desktop.height}
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
          <Image
            className="mkt-hero-preview-img mkt-hero-preview-mobile"
            src={HERO_PREVIEW.mobile.src}
            alt={alt}
            width={HERO_PREVIEW.mobile.width}
            height={HERO_PREVIEW.mobile.height}
            sizes="100vw"
            priority
          />
        </div>
        <figcaption className="mkt-hero-preview-caption">{caption}</figcaption>
      </figure>
    </header>
  );
}
