'use client';

import {
  domAnimation,
  LazyMotion,
  m,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { JourneyChapterId, JourneyCopy } from './copy';
import { SceneLayers } from './scenes';
import { JourneyTicket } from './ticket';
import { CAPTION, KEY_FRAMES, T } from './timeline';
import type { MarketingLocale } from '../hosts';
import type { JourneyMilestone } from '../analytics/events';
import { trackJourneyMilestone } from '../analytics/client';
import { milestoneAt, oncePerView } from './progress';

type Reach = (milestone: JourneyMilestone) => void;

const CHAPTERS: JourneyChapterId[] = ['invitation', 'arrival', 'gateway', 'moment'];

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
/**
 * Progressive enhancement: server HTML (and no-JS / reduced-motion clients) get
 * the still-frame journey with usable CTAs; motion-capable clients upgrade to
 * the scroll journey after hydration. Frame 1 is identical in both modes.
 */
function useScrollMode(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => !window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/** Visual stack only — decorative, hidden from assistive tech. */
function SceneStack({ p, copy, still = false }: { p: MotionValue<number>; copy: JourneyCopy; still?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--jr-void)]" aria-hidden="true">
      <SceneLayers p={p} still={still} />
      <JourneyTicket p={p} copy={copy} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,4,12,0.7)_0%,transparent_45%)] max-md:bg-[linear-gradient(0deg,rgba(3,4,12,0.92)_0%,rgba(3,4,12,0.6)_28%,transparent_48%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_45%,transparent_55%,rgba(2,3,9,0.85)_100%)]" />
      <div className="jr-grain pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay" />
    </div>
  );
}

const captionBox =
  'absolute left-[clamp(1.25rem,6vw,5.5rem)] bottom-[clamp(2rem,11dvh,7rem)] max-w-[30rem] max-md:left-5 max-md:right-5 max-md:bottom-[7dvh] [@media(max-height:560px)_and_(orientation:landscape)]:bottom-5 [@media(max-height:560px)_and_(orientation:landscape)]:max-w-[55vw]';

function ChapterCaption({
  id,
  copy,
  heading: Heading,
}: {
  id: JourneyChapterId;
  copy: JourneyCopy;
  heading: 'h1' | 'h2';
}) {
  const c = copy.chapters[id];
  return (
    <>
      <p className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-[var(--jr-amber)]">
        <span className="tabular-nums">{c.index}</span>
        <span className="h-px w-8 bg-current opacity-60" />
        {c.label}
      </p>
      <Heading id={`jr-${id}`} className="mt-4 font-display text-[clamp(2.1rem,5vw,4.25rem)] [@media(max-height:560px)_and_(orientation:landscape)]:mt-2 [@media(max-height:560px)_and_(orientation:landscape)]:text-[1.9rem] font-bold leading-[0.98] tracking-[-0.02em] text-[var(--jr-paper)] [text-wrap:balance]">
        {c.title}
      </Heading>
      <p className="mt-4 max-w-[26rem] [@media(max-height:560px)_and_(orientation:landscape)]:mt-2 [@media(max-height:560px)_and_(orientation:landscape)]:text-[0.9rem] text-[clamp(0.98rem,1.3vw,1.12rem)] leading-relaxed text-[var(--jr-muted)]">
        {c.body}
      </p>
    </>
  );
}

function ScrollCaption({ id, p, copy }: { id: JourneyChapterId; p: MotionValue<number>; copy: JourneyCopy }) {
  const w = CAPTION[id];
  const opacity = useTransform(p, [...w], [0, 1, 1, 0]);
  const y = useTransform(p, [...w], [28, 0, 0, -20]);
  const filter = useTransform(p, [w[0], w[1]], ['blur(8px)', 'blur(0px)']);
  return (
    <m.section aria-labelledby={`jr-${id}`} className={captionBox} style={{ opacity, y, filter }}>
      <ChapterCaption id={id} copy={copy} heading={id === 'invitation' ? 'h1' : 'h2'} />
    </m.section>
  );
}

function ChapterRail({ p, copy }: { p: MotionValue<number>; copy: JourneyCopy }) {
  const fill = useTransform(p, [0, 0.86], ['0%', '100%']);
  const opacity = useTransform(p, [0.86, 0.9], [1, 0]);
  return (
    <m.div
      className="absolute right-[clamp(1rem,3vw,2.5rem)] top-1/2 flex -translate-y-1/2 items-stretch gap-3 max-md:hidden [@media(max-height:560px)_and_(orientation:landscape)]:hidden"
      style={{ opacity }}
      aria-hidden="true"
    >
      <div className="relative w-px bg-white/15">
        <m.div className="absolute inset-x-0 top-0 bg-[var(--jr-amber)]" style={{ height: fill }} />
      </div>
      <ol className="flex flex-col justify-between gap-10 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-white/45">
        {CHAPTERS.map((id) => (
          <li key={id}>
            {copy.chapters[id].index} · {copy.chapters[id].label}
          </li>
        ))}
      </ol>
    </m.div>
  );
}

function BrandPanel({ copy, cta, active = true }: { copy: JourneyCopy; cta: ReactNode; active?: boolean }) {
  return (
    <div
      className="flex flex-col items-center px-6 text-center [@media(max-height:560px)_and_(orientation:landscape)]:pt-[72px]"
      inert={!active}
    >
      <p className="font-display text-[1.05rem] font-bold tracking-tight text-white/80">
        Vemoki<span className="text-[var(--jr-amber)]"> ↗</span>
      </p>
      <h2
        id="jr-brand"
        className="mt-5 font-display text-[clamp(2.6rem,7vw,6rem)] [@media(max-height:560px)_and_(orientation:landscape)]:mt-2 [@media(max-height:560px)_and_(orientation:landscape)]:text-[2.5rem] font-bold leading-[0.95] tracking-[-0.03em] text-[var(--jr-paper)] [text-wrap:balance]"
      >
        {copy.brandTitle}
      </h2>
      <p className="mt-5 max-w-[34rem] text-[clamp(1rem,1.4vw,1.2rem)] leading-relaxed text-[var(--jr-muted)]">
        {copy.brandBody}
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3 [@media(max-height:560px)_and_(orientation:landscape)]:mt-4">{cta}</div>
    </div>
  );
}

function ScrollJourney({ copy, cta, reach }: { copy: JourneyCopy; cta: ReactNode; reach: Reach }) {
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 32, mass: 0.6, restDelta: 0.0005 });
  const [brandActive, setBrandActive] = useState(false);
  const [live, setLive] = useState(true);

  useMotionValueEvent(p, 'change', (v) => {
    setBrandActive(v >= T.brand[0]);
    const rect = track.current?.getBoundingClientRect();
    if (document.visibilityState === 'visible' && rect && rect.top <= innerHeight && rect.bottom >= 0) {
      reach(milestoneAt(v));
    }
  });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      setLive(Boolean(e?.isIntersecting));
      if (e?.isIntersecting && document.visibilityState === 'visible') reach(milestoneAt(p.get()));
    });
    io.observe(el);
    return () => io.disconnect();
  }, [p, reach]);

  const hintO = useTransform(p, [0, 0.03], [1, 0]);
  const brandO = useTransform(p, [T.brand[0], T.brand[1]], [0, 1]);
  const brandY = useTransform(p, [T.brand[0], T.brand[1]], [40, 0]);
  const brandScrim = useTransform(p, [T.brand[0] - 0.04, T.brand[1]], [0, 0.62]);

  return (
    <div ref={track} className="relative h-[620dvh] max-md:h-[520dvh]" data-live={live} data-journey-track="">
      <div className="sticky top-0 h-dvh overflow-hidden">
        <SceneStack p={p} copy={copy} />
        <div className="absolute inset-0">
          {CHAPTERS.map((id) => (
            <ScrollCaption key={id} id={id} p={p} copy={copy} />
          ))}
          <ChapterRail p={p} copy={copy} />
          <m.div
            className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 max-md:hidden [@media(max-height:560px)_and_(orientation:landscape)]:hidden text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-white/60"
            style={{ opacity: hintO }}
            aria-hidden="true"
          >
            {copy.scrollHint}
            <span className="jr-anim jr-hint block h-10 w-px bg-gradient-to-b from-white/70 to-transparent" />
          </m.div>
          <m.div className="pointer-events-none absolute inset-0 bg-[var(--jr-void)]" style={{ opacity: brandScrim }} />
          <m.section
            aria-labelledby="jr-brand"
            className="absolute inset-0 flex items-center justify-center"
            style={{ opacity: brandO, y: brandY, pointerEvents: brandActive ? 'auto' : 'none' }}
          >
            <BrandPanel copy={copy} cta={cta} active={brandActive} />
          </m.section>
        </div>
      </div>
    </div>
  );
}

function StillFrame({ progress, children, copy }: { progress: number; children: ReactNode; copy: JourneyCopy }) {
  const p = useMotionValue(progress);
  return (
    <div className="relative h-dvh min-h-[560px] overflow-hidden">
      <SceneStack p={p} copy={copy} still />
      {children}
    </div>
  );
}

/** Reduced motion: four composed still frames + brand, no scroll-linked motion. */
function StillJourney({ copy, cta, reach, observe }: { copy: JourneyCopy; cta: ReactNode; reach: Reach; observe: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!observe || !root.current) return;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && document.visibilityState === 'visible') {
          reach(entry.target.getAttribute('data-milestone') as JourneyMilestone);
        }
      }
    }, { threshold: 0.5 });
    root.current.querySelectorAll('[data-milestone]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [observe, reach]);
  return (
    <div ref={root} data-live="false">
      {CHAPTERS.map((id) => (
        <StillFrame key={id} progress={KEY_FRAMES[id]} copy={copy}>
          <section data-milestone={id} aria-labelledby={`jr-${id}`} className={captionBox}>
            <ChapterCaption id={id} copy={copy} heading={id === 'invitation' ? 'h1' : 'h2'} />
          </section>
        </StillFrame>
      ))}
      <StillFrame progress={1} copy={copy}>
        <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--jr-void)_60%,transparent)]" />
        <section data-milestone="complete" aria-labelledby="jr-brand" className="absolute inset-0 flex items-center justify-center">
          <BrandPanel copy={copy} cta={cta} />
        </section>
      </StillFrame>
    </div>
  );
}

export function JourneyExperience({ copy, cta, locale }: { copy: JourneyCopy; cta: ReactNode; locale: MarketingLocale }) {
  const scrollMode = useScrollMode();
  const [reach] = useState(() => oncePerView((milestone) => trackJourneyMilestone(milestone, locale)));
  return (
    <LazyMotion features={domAnimation} strict>
      {scrollMode
        ? <ScrollJourney copy={copy} cta={cta} reach={reach} />
        : <StillJourney copy={copy} cta={cta} reach={reach} observe={!scrollMode} />}
    </LazyMotion>
  );
}

