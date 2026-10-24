import { Button } from '@ticket/ui';
import Image from 'next/image';
import Link from 'next/link';
import { t } from '../copy';
import {
  marketingDemoNote,
  marketingDisplay,
  marketingHeroCopy,
  marketingHeroGrid,
  marketingHeroLogin,
  marketingHeroMedia,
  marketingHeroMediaCaption,
  marketingHeroMediaImg,
  marketingHeroSection,
  marketingH1,
  marketingLead,
  marketingWrap,
} from '../marketing-surface';
import type { MarketingSectionProps } from './types';

export function HeroSection({ locale, demo, login }: MarketingSectionProps) {
  return (
    <section
      id="top"
      className={marketingHeroSection}
      aria-labelledby="hero-title"
      data-analytics-section="hero"
      data-on-ink=""
    >
      <div className={`${marketingWrap} ${marketingHeroGrid}`}>
        <div className={marketingHeroCopy}>
          <h1 id="hero-title" className={`${marketingDisplay} ${marketingH1}`} data-testid="hero-headline">
            {t(locale, 'hero.headline')}
          </h1>
          <p className={marketingLead}>{t(locale, 'hero.sub')}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild variant="primary" data-testid="cta-demo" data-analytics-cta="hero_demo">
              <a href={demo}>{t(locale, 'hero.cta.demo')}</a>
            </Button>
            <Link
              href="#interest"
              className="inline-flex min-h-11 items-center px-2 font-semibold text-paper underline underline-offset-4 hover:text-paper/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
              data-testid="cta-interest"
              data-analytics-cta="hero_interest"
            >
              {t(locale, 'hero.cta.interest')}
            </Link>
          </div>
          <p className={marketingHeroLogin}>
            {t(locale, 'hero.login_prefix')}{' '}
            <a href={login} data-testid="cta-login" data-analytics-cta="hero_login">
              {t(locale, 'hero.cta.login')}
            </a>
          </p>
          <p className={marketingDemoNote} role="status" data-testid="demo-badge">
            {t(locale, 'hero.demo_note')}
          </p>
        </div>
        <figure className={marketingHeroMedia}>
          <Image
            className={marketingHeroMediaImg}
            src="/marketing/product/catalog-7bd933401625.png"
            alt={t(locale, 'hero.media.alt')}
            width={1440}
            height={900}
            sizes="(max-width: 1024px) 100vw, 52vw"
            priority
          />
          <figcaption className={marketingHeroMediaCaption}>
            {t(locale, 'hero.media.caption')}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
