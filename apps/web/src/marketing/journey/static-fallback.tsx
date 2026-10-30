import Image from 'next/image';
import { t } from '../copy';
import { demoHref, productOriginFromEnv, type MarketingLocale } from '../hosts';
import { journeyHref, salesHref } from '../links';
import { journeyCopy, type JourneyChapterId } from './copy';

const FRAMES: Array<[JourneyChapterId, string]> = [
  ['invitation', 'ticket-night'], ['arrival', 'gateway-closed'],
  ['gateway', 'gateway-open'], ['moment', 'stage-main'],
];

/** Pure server HTML for Next's streaming fallback: no client modules or reveal script needed. */
export function JourneyStaticFallback({ locale }: { locale: MarketingLocale }) {
  const copy = journeyCopy(locale);
  return (
    <div lang={locale} data-journey-static-fallback="" className="bg-[#03040c] text-[#faf9ff]">
      <header className="flex min-h-[72px] items-center justify-between gap-4 px-5">
        <a href={salesHref(locale)} className="font-display text-xl font-bold">Vemoki</a>
        <nav aria-label={t(locale, 'nav.locale.label')} className="flex gap-5">
          <a href={journeyHref('vi')} lang="vi">VI</a>
          <a href={journeyHref('en')} lang="en">EN</a>
        </nav>
      </header>
      <main id="main">
        {FRAMES.map(([id, plate], index) => {
          const chapter = copy.chapters[id];
          const Heading = index === 0 ? 'h1' : 'h2';
          return (
            <section key={id} className="relative flex min-h-dvh items-end overflow-hidden px-5 py-16 sm:px-16">
              <Image unoptimized src={`/marketing/journey/${plate}-1536.webp`} alt="" width={1536} height={1024}
                loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'}
                className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#03040c] via-[#03040c]/30 to-transparent" />
              <div className="relative max-w-xl">
                <p className="text-sm text-[#ffb547]">{chapter.index} · {chapter.label}</p>
                <Heading className="mt-4 font-display text-4xl font-bold">{chapter.title}</Heading>
                <p className="mt-4 text-lg leading-relaxed text-[#c2c6de]">{chapter.body}</p>
              </div>
            </section>
          );
        })}
        <section className="px-5 py-20 text-center">
          <h2 className="font-display text-4xl font-bold">{copy.brandTitle}</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[#c2c6de]">{copy.brandBody}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-6">
            <a className="rounded-xl bg-[#7c4ded] px-6 py-3 font-semibold text-white" href={demoHref(productOriginFromEnv())}>{t(locale, 'demo.cta')}</a>
            <a className="px-6 py-3 underline" href={`${salesHref(locale)}#interest`}>{t(locale, 'nav.interest')}</a>
          </div>
        </section>
      </main>
    </div>
  );
}
