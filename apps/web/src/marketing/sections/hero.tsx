import Image from 'next/image';
import { Button } from '@ticket/ui';
import { t } from '../copy';
import { marketingWrap } from '../marketing-surface';
import type { MarketingSectionProps } from './types';

export function HeroSection({ locale, demo }: MarketingSectionProps) {
  return (
    <section id="top" data-analytics-section="hero" data-on-ink="" data-testid="marketing-neon-hero" className="overflow-hidden bg-ink px-5 py-16 text-paper md:py-24">
      <div className={`${marketingWrap} grid items-center gap-10 md:grid-cols-2`}>
        <div>
          <h1 id="hero-title" data-testid="hero-headline" className="m-0 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            {t(locale, 'neon.hero.headline.lead')}
            <span className="text-primary">{t(locale, 'neon.hero.headline.emphasis')}</span>.
          </h1>
          <p className="mt-6 text-lg leading-relaxed">{t(locale, 'hero.sub')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="primary" data-testid="cta-demo" data-analytics-cta="hero_demo"><a href={demo}>{t(locale, 'hero.cta.demo')}</a></Button>
            <Button asChild variant="ghostOnInk" data-testid="cta-interest" data-analytics-cta="hero_interest"><a href="#interest">{t(locale, 'hero.cta.interest')}</a></Button>
          </div>
          <p className="mt-4 text-sm" data-testid="demo-badge">{t(locale, 'hero.demo_note')}</p>
          <ul className="mt-8 flex list-none flex-wrap gap-3 p-0 text-sm">
            {(['hero.proof1', 'hero.proof2', 'hero.proof3', 'hero.proof4'] as const).map((key) => <li key={key} className="rounded-full border border-paper/25 px-3 py-2">{t(locale, key)}</li>)}
          </ul>
        </div>
        <Image src="/marketing/neon/hero-composite-v2.png" alt={t(locale, 'neon.hero.visual.label')} width={960} height={640} priority sizes="(min-width: 768px) 50vw, 100vw" className="h-auto w-full" />
      </div>
    </section>
  );
}
