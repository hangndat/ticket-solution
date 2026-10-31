import Image from 'next/image';
import { Button } from '@ticket/ui';
import { t } from '../copy';
import { marketingWrap } from '../marketing-surface';
import type { MarketingSectionProps } from './types';

const events = [
  ['neon.events.card1.title', 'neon.events.card1.alt'],
  ['neon.events.card2.title', 'neon.events.card2.alt'],
  ['neon.events.card3.title', 'neon.events.card3.alt'],
  ['neon.events.card4.title', 'neon.events.card4.alt'],
] as const;

export function NeonShowcase({ locale, demo }: MarketingSectionProps) {
  return (
    <>
      <section id="events" data-testid="marketing-neon-events" className="bg-ink px-5 py-16 text-paper md:py-24">
        <div className={marketingWrap}>
          <h2 className="text-3xl font-bold md:text-5xl">{t(locale, 'neon.events.title.lead')} <span className="text-primary">{t(locale, 'neon.events.title.emphasis')}</span></h2>
          <p className="mt-4 text-lg">{t(locale, 'neon.events.sub')}</p>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {events.map(([title, alt], index) => (
              <article key={title} className="overflow-hidden rounded-xl border border-paper/20">
                <Image src={`/marketing/neon/event${index + 1}.jpg`} alt={t(locale, alt)} width={400} height={265} sizes="(min-width: 1024px) 25vw, 50vw" className="aspect-[3/2] w-full object-cover" />
                <h3 className="m-0 p-4 text-base">{t(locale, title)}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section id="product" data-testid="marketing-neon-product" className="bg-ink px-5 py-16 text-paper md:py-24">
        <div className={`${marketingWrap} grid items-center gap-10 md:grid-cols-2`}>
          <div>
            <h2 className="text-3xl font-bold md:text-5xl">{t(locale, 'neon.product.title.lead')} <span className="text-primary">{t(locale, 'neon.product.title.emphasis')}</span></h2>
            <ul className="my-8 space-y-3 pl-5 text-lg">{(['neon.product.f1', 'neon.product.f2', 'neon.product.f3', 'neon.product.f4'] as const).map((key) => <li key={key}>{t(locale, key)}</li>)}</ul>
            <Button asChild variant="primary" data-analytics-cta="product_demo"><a href={demo}>{t(locale, 'neon.product.cta')}</a></Button>
          </div>
          <figure className="m-0">
            <Image src="/marketing/neon/product.jpg" alt={t(locale, 'neon.product.image.alt')} width={900} height={620} sizes="(min-width: 768px) 50vw, 100vw" className="h-auto w-full rounded-xl" />
            <figcaption className="mt-2 text-sm">{t(locale, 'neon.product.image.caption')}</figcaption>
          </figure>
        </div>
      </section>
    </>
  );
}

export function NeonFinalCta({ locale, demo }: MarketingSectionProps) {
  return (
    <section id="contact" data-testid="marketing-neon-final-cta" className="relative isolate overflow-hidden bg-ink px-5 py-24 text-paper md:py-32">
      <Image src="/marketing/neon/final-cta-crowd-v2.png" alt="" fill sizes="100vw" className="-z-20 object-cover" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/80" />
      <div className={marketingWrap}>
        <h2 className="text-3xl font-bold md:text-5xl">{t(locale, 'neon.final.title.line1')} <span className="text-primary">{t(locale, 'neon.final.title.emphasis')}</span></h2>
        <p className="mt-5 text-lg">{t(locale, 'neon.final.sub')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="primary" data-testid="cta-demo-final" data-analytics-cta="final_demo"><a href={demo}>{t(locale, 'hero.cta.demo')}</a></Button>
          <Button asChild variant="ghostOnInk" data-testid="cta-interest-final" data-analytics-cta="final_interest"><a href="#interest">{t(locale, 'hero.cta.interest')}</a></Button>
        </div>
      </div>
    </section>
  );
}
