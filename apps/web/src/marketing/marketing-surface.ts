import { cn } from '../../lib/utils';

/** Marketing shell + section utilities (Tailwind v4 / @theme tokens — replaces marketing-uplift.css). */

export const marketingSurface =
  'flex flex-col min-h-dvh max-w-full overflow-x-clip text-ink antialiased scheme-light [&>main]:flex-1 [&>main]:min-w-0 [&>main]:w-full [&>main_a]:underline [&>main_a]:decoration-1 [&>main_a]:underline-offset-[3px] hover:[&>main_a]:text-focus';

export const marketingSkip =
  'skip-link absolute -left-[9999px] top-0 z-[100] rounded-sm bg-ink px-4 py-3 text-paper focus:left-4 focus:top-4';

export function marketingHeader(onSales: boolean, onInk: boolean) {
  return cn(
    'sticky top-0 z-20 flex min-h-[72px] w-full min-w-0 items-center gap-4 px-[clamp(1.25rem,4vw,2rem)] backdrop-blur-md [&_a[href]]:no-underline',
    'lg:gap-5 xl:gap-6',
    onInk
      ? 'border-b border-paper/10 bg-ink/90 text-paper'
      : 'border-b border-line bg-paper/90',
    onSales && 'max-md:min-w-0 max-md:max-w-full max-md:flex-nowrap max-md:gap-3',
  );
}

export const marketingWordmark = cn(
  'min-w-0 shrink font-display text-[1.65rem] font-bold tracking-tight text-inherit no-underline',
  '[&_span]:text-signal',
  'max-lg:max-w-[9.5rem] max-lg:overflow-hidden max-lg:text-ellipsis max-lg:whitespace-nowrap max-lg:text-[1.35rem]',
  'max-md:max-w-[42vw] max-md:flex-[0_1_auto]',
);

export const marketingNav = cn(
  'flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-1',
  'max-md:gap-[0.15rem]',
);

export const marketingNavLinks = cn(
  'hidden items-center gap-[0.1rem] xl:inline-flex',
  '[&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-sm [&_a]:px-[0.65rem] [&_a]:py-[0.45rem] [&_a]:text-[0.82rem] [&_a]:whitespace-nowrap [&_a]:no-underline',
  'text-paper/85',
);

export const marketingLocaleGroup = cn(
  'mr-2 inline-flex items-center gap-1 rounded-[10px] p-1',
  'bg-ink/6 max-md:mr-[0.15rem]',
  '[[data-header-on-ink]_&]:bg-paper/10',
);

export const marketingLocaleLink = cn(
  'inline-flex min-h-9 min-w-9 items-center justify-center rounded-[7px] border-0 bg-transparent px-[0.65rem] py-[0.35rem] text-[0.8rem] font-semibold text-inherit no-underline',
  'max-md:min-h-11',
  'aria-[current=true]:bg-paper aria-[current=true]:text-ink aria-[current=true]:shadow-sm',
  '[[data-header-on-ink]_&]:aria-[current=true]:bg-paper/15 [[data-header-on-ink]_&]:aria-[current=true]:text-paper',
);

export const marketingNavMenuToggle = cn(
  'hidden min-h-11 min-w-11 cursor-pointer items-center gap-[0.35rem] rounded-sm border border-paper/15 bg-paper/5 px-[0.65rem] py-[0.35rem] text-[0.82rem] font-semibold text-inherit',
  'max-xl:inline-flex',
  'focus-visible:outline focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2',
);

export const marketingNavMobileLink = cn(
  'flex min-h-11 items-center rounded-sm px-3 py-2 text-[0.95rem] font-medium text-paper/90 no-underline',
  'focus-visible:outline focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2',
);

export const marketingNavMobileActions =
  'grid gap-2 border-t border-paper/10 pt-1.5';

const sectionPad = 'px-[clamp(1.25rem,4vw,2rem)] py-[clamp(4rem,8vw,6.5rem)] max-md:max-w-full max-md:overflow-x-clip';

export const marketingWrap = 'relative z-[1] mx-auto max-w-[1120px]';

export function marketingSection(
  variant: 'ink' | 'paper' | 'paperAlt' | 'interest',
  extra?: string,
) {
  return cn(
    sectionPad,
    variant === 'ink' &&
      'relative overflow-hidden bg-ink text-paper before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_80%_60%_at_70%_20%,color-mix(in_srgb,var(--color-signal)_15%,transparent),transparent_55%),radial-gradient(ellipse_50%_40%_at_10%_80%,color-mix(in_srgb,var(--color-focus)_12%,transparent),transparent_50%)]',
    variant === 'paper' && 'bg-paper text-ink',
    variant === 'paperAlt' &&
      'bg-gradient-to-b from-[color-mix(in_srgb,var(--color-ink)_6%,var(--color-paper))] to-paper text-ink',
    variant === 'interest' &&
      'relative border-t border-line bg-gradient-to-br from-paper via-[color-mix(in_srgb,var(--color-ink)_4%,var(--color-paper))] to-paper before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_70%_50%_at_20%_0%,color-mix(in_srgb,var(--color-signal)_12%,transparent),transparent_55%)]',
    extra,
  );
}

export const marketingEyebrow = cn(
  'mb-4 text-[0.7rem] font-bold tracking-[0.14em] text-muted uppercase',
  '[[data-on-ink]_&]:text-paper/65',
);

export const marketingDisplay = 'font-display m-0 font-bold tracking-tight leading-[1.08]';

export const marketingH1 = cn(
  marketingDisplay,
  'max-w-[14ch] text-[clamp(2.35rem,5.5vw,3.75rem)] min-h-[2.35em]',
);

export const marketingH2 = cn(
  marketingDisplay,
  'mb-3 text-[clamp(1.75rem,3.5vw,2.35rem)]',
);

export const marketingInterestH2 = cn(
  marketingH2,
  'max-w-[16ch] text-[clamp(1.95rem,4vw,2.75rem)]',
);

export const marketingLead = cn(
  'mt-4 max-w-[52ch] text-[clamp(1.05rem,2vw,1.2rem)] text-muted',
  '[[data-on-ink]_&]:text-paper/90',
);

export const marketingDemoNote = cn(
  'mt-4 text-[0.85rem] text-muted',
  '[[data-on-ink]_&]:text-paper/60',
);

export const marketingHeroSection = cn(
  marketingSection('ink'),
  'min-h-[min(82vh,46rem)] pt-[clamp(2.5rem,6vw,4rem)] pb-[clamp(3rem,8vw,5rem)]',
);

export const marketingHeroGrid = cn(
  'grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-12',
);

export const marketingHeroCopy =
  'max-md:min-h-[40rem] lg:min-h-[28rem]';

export const marketingHeroPoints = cn(
  'mt-6 flex list-none flex-col gap-[0.65rem] p-0',
  '[&_li]:relative [&_li]:pl-[1.35rem] [&_li]:text-[0.9rem] [&_li]:text-paper/80',
  '[&_li]:before:absolute [&_li]:before:top-[0.55em] [&_li]:before:left-0 [&_li]:before:size-1.5 [&_li]:before:rounded-full [&_li]:before:bg-signal [&_li]:before:shadow-[0_0_12px_var(--color-signal)]',
);

export const marketingMarquee = cn(
  'mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]',
);

export const marketingMarqueeTrack = cn(
  'flex gap-8 whitespace-nowrap text-[0.75rem] font-semibold tracking-[0.06em] text-paper/35 uppercase',
  'motion-safe:animate-[mkt-marquee_28s_linear_infinite] motion-reduce:animate-none',
  '[&>span]:shrink-0',
);

export const marketingTrustGrid =
  'mt-10 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6';

export const marketingTrustCard = cn(
  'rounded-md border border-paper/10 bg-paper/5 p-6 transition-colors motion-reduce:transition-none',
  'hover:border-signal/35 hover:bg-paper/[0.06]',
  '[&_h3]:font-display [&_h3]:m-0 [&_h3]:mb-2 [&_h3]:text-[1.05rem]',
  '[&_p]:m-0 [&_p]:text-[0.9rem] [&_p]:leading-snug [&_p]:text-paper/70',
);

export const marketingTrustIcon =
  'mb-4 grid size-10 place-items-center rounded-[10px] bg-signal/10 text-lg text-signal';

export const marketingTrustRow2 =
  'mt-5 grid grid-cols-1 gap-5 md:grid-cols-2';

export const marketingAudienceGrid =
  'mt-8 grid grid-cols-1 gap-4 md:grid-cols-2';

export const marketingAudienceCard = (emphasis: boolean) =>
  cn(
    'rounded-md border border-line p-6',
    emphasis
      ? 'border-focus/20 bg-paper shadow-soft'
      : 'border-line bg-transparent',
    '[&_h3]:font-display [&_h3]:my-2 [&_h3]:text-[1.15rem]',
    '[&_p]:m-0 [&_p]:text-[0.9rem] [&_p]:text-muted',
  );

export const marketingAudienceIcon = 'text-2xl';

export const marketingStack = 'grid gap-4';

export const marketingRow = cn(
  'grid gap-1.5 border-b border-line pb-4 last:border-0',
  '[&_h3]:m-0 [&_h3]:font-display [&_h3]:text-[1.05rem]',
  '[&_p]:m-0 [&_p]:text-muted',
);

export const marketingDemoBannerInk = cn(
  'mb-6 rounded-sm border border-signal/35 bg-signal/15 px-4 py-3.5 text-[0.85rem] font-semibold text-[color-mix(in_srgb,var(--color-signal)_30%,var(--color-paper))]',
);

export const marketingDemoBannerPaper = cn(
  'rounded-sm border border-dashed border-signal/45 bg-signal/10 px-3.5 py-2.5 text-[0.9rem]',
);

export const marketingMetrics =
  'mb-8 grid grid-cols-1 gap-4 md:grid-cols-3';

export const marketingChart = cn(
  'rounded-md border border-paper/10 bg-black/20 p-5',
);

export const marketingChartBars = cn(
  'mt-4 flex h-[120px] items-end gap-1.5',
  '[&_span]:min-h-3 [&_span]:flex-1 [&_span]:rounded-t-sm [&_span]:bg-gradient-to-t [&_span]:from-signal [&_span]:to-signal/40',
);

export const marketingChartCaption = 'mt-3 text-[0.8rem] text-paper/55';

export const marketingOutcomesDemoNote =
  'ml-3 inline-block text-[0.85rem] text-muted';

export const marketingFaqSectionTitle = cn(marketingH2, 'mx-auto mt-8 max-w-[40rem]');

export const marketingFaqList = 'grid max-w-[42rem] gap-1.5';

export const marketingFaqItem = 'border-b border-line';

export const marketingFaqQuestion = cn(
  'flex min-h-11 cursor-pointer list-none items-center px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden',
);

export const marketingFaqQuestionText =
  'flex-1 font-display text-base';

export const marketingFaqAnswer = cn(
  'px-4 pb-3.5 text-muted',
  '[&_p]:m-0',
);

export const marketingInterestGrid =
  'grid items-start gap-10 lg:grid-cols-2';

export const marketingForm = cn(
  'grid gap-3.5 rounded-lg border border-line bg-paper p-6 shadow-soft',
);

export const marketingFormField = 'grid gap-1.5';

export const marketingFieldError = 'text-sm font-medium text-signal';

export const marketingHp =
  'absolute! -left-[9999px]! h-px w-px overflow-hidden';

export const marketingConsent = 'flex items-start gap-2.5 font-normal!';

export const marketingFooter = (onSales: boolean) =>
  cn(
    'px-[clamp(1.25rem,4vw,2rem)] py-10 text-[0.9rem]',
    onSales
      ? 'bg-ink text-paper/75'
      : 'border-t border-line text-muted',
    '[&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:text-paper/85 [&_a]:no-underline',
  );

export const marketingLegal = cn(
  'max-w-3xl py-10 pb-16',
  '[&_section]:border-t [&_section]:border-line [&_section]:py-[clamp(2rem,5vw,3rem)]',
  '[&_h1]:font-display [&_h1]:tracking-tight',
  '[&_h2]:mt-7 [&_h2]:font-display [&_h2]:text-xl',
);

export const marketingHowNote = cn(
  'mt-8 rounded-md border-l-[3px] border-signal bg-signal/10 px-5 py-4 text-[0.9rem] text-ink',
);

export const marketingBentoGrid = cn(
  'mt-1 motion-safe:[@supports(animation-timeline:view())]:animate-[mkt-bento-reveal_0.28s_cubic-bezier(0.22,1,0.36,1)_both] motion-safe:[@supports(animation-timeline:view())]:opacity-0 motion-reduce:animate-none motion-reduce:opacity-100',
);

export const marketingBentoItem = 'min-h-0';

export const marketingBentoCard = cn(
  'h-full border-line transition-colors hover:border-ink/30 motion-reduce:transition-none',
);

export const marketingBentoCardInner =
  'grid h-full gap-3.5 p-4! md:grid-cols-1 md:items-start md:p-[1.1rem]!';

export function marketingBentoCardInnerSpan(span: string) {
  const wide = span === 'invite' || span === 'admin' || span === 'ops';
  return cn(wide && 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]!');
}

export const marketingBentoCopy = 'grid gap-1.5';

export const marketingBentoCardTitle =
  'm-0 font-display text-[1.05rem]!';

export const marketingBentoCardBody =
  'm-0 text-[0.92rem] leading-snug text-muted';

export const marketingBentoFigure = cn(
  'm-0 aspect-[16/10] overflow-hidden rounded-sm border border-line bg-ink/5',
  '[[data-span=ops]_&]:max-h-48 md:[[data-span=ops]_&]:max-h-none',
);

export const marketingBentoImg =
  'block size-full object-cover object-top';
