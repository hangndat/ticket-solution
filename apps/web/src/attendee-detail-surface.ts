import { cn } from '../lib/utils';

/**
 * Attendee detail routes (event / ticket / wallet) — Tailwind v4, replaces legacy + module.css.
 *
 * D-1 hex → @theme token replacements (nearest vemoki/tokens.json):
 * | legacy hex | token / mix |
 * | #13504b | color-mix(admit 85%, ink) |
 * | #82d6b3 | color-mix(admit 55%, paper) |
 * | #6e451d | color-mix(unknown 90%, ink) |
 * | #eac786 | color-mix(unknown 45%, paper) |
 * | #182941 | color-mix(ink 92%, focus) |
 * | #f26583 | color-mix(signal 75%, paper) |
 * | #fff / #ffffff | paper (on dark hero) or white utility |
 * | #fff7f9 | color-mix(signal 6%, white) |
 * | #be123c | color-mix(signal 88%, ink) |
 * | #cbd5e1 | color-mix(line 85%, muted) |
 * | #f8fafc | color-mix(paper 96%, white) |
 * | #8a1f1f | destructive |
 * | #f8e8e8 | color-mix(destructive 12%, paper) |
 * | #4a4a4a | color-mix(ink 55%, muted) |
 * | #ececec | color-mix(paper 88%, ink) |
 * | #2a2a2a | color-mix(ink 88%, muted) |
 * | #edf5ef / #27744d | color-mix(admit 12%, paper) / admit |
 * | #eef2f7 / #4a5c73 | color-mix(focus 10%, paper) / color-mix(ink 45%, muted) |
 * | #fdeef1 / #9f2840 | color-mix(signal 12%, paper) / color-mix(destructive 75%, signal) |
 */

export const attendeeDetailMain = cn(
  'mx-auto w-full max-w-[1200px] px-[var(--spacing-2xl)] min-w-0',
  'pb-12 max-md:px-4',
);

export const attendeeTicketMain = cn(
  attendeeDetailMain,
  'max-w-[40rem]',
);

export const attendeeEventPage = cn(
  'pb-12 text-[currentColor]',
  '[&_nav]:border-[currentColor] [&_.wordmark]:text-[1.35rem]',
);

export const attendeeEventBody = 'py-[var(--spacing-2xl)] pb-[var(--spacing-3xl)]';

export const attendeeEventBackLink = cn(
  'inline-flex min-h-11 items-center gap-1.5 mb-4 text-[0.88rem] font-semibold no-underline',
  'text-[color-mix(in_srgb,var(--color-focus)_72%,var(--color-ink))] hover:text-ink hover:underline',
);

export function attendeeEventHeroArt(tone: string) {
  const toneBg =
    tone === 'green'
      ? 'bg-[color-mix(in_srgb,var(--color-admit)_85%,var(--color-ink))] after:border-[color-mix(in_srgb,var(--color-admit)_55%,var(--color-paper))]'
      : tone === 'gold'
        ? 'bg-[color-mix(in_srgb,var(--color-unknown)_90%,var(--color-ink))] after:border-[color-mix(in_srgb,var(--color-unknown)_45%,var(--color-paper))]'
        : 'bg-[color-mix(in_srgb,var(--color-ink)_92%,var(--color-focus))] after:border-[color-mix(in_srgb,var(--color-signal)_75%,var(--color-paper))]';
  return cn(
    'relative flex min-h-[clamp(200px,32vw,280px)] items-end overflow-hidden rounded-2xl',
    'animate-in fade-in duration-500 fill-mode-both motion-reduce:animate-none',
    'p-[clamp(22px,4vw,32px)] text-white isolation-isolate',
    'max-md:min-h-[200px] max-md:items-center',
    toneBg,
    'after:pointer-events-none after:absolute after:right-[-65px] after:top-[-10px]',
    'after:h-[180px] after:w-[180px] after:rounded-full after:border-[32px] after:opacity-65 after:content-[""]',
  );
}

export const attendeeEventHeroInner = 'relative z-[1] max-w-[42rem]';

export const attendeeEventHeroTitle = cn(
  'm-0 font-display text-[clamp(2rem,6vw,3.4rem)] font-extrabold leading-[1.08] tracking-[-0.04em] text-white',
  'max-md:text-[clamp(1.65rem,8vw,2.25rem)]',
);

export const attendeeEventHeroMeta = cn(
  'm-0 mt-3 text-[clamp(0.92rem,2.2vw,1.05rem)] font-semibold leading-[1.45]',
  'text-[color-mix(in_srgb,var(--color-paper)_88%,white)] [&_time]:text-inherit',
);

export const attendeeEventHeroSep = 'mx-[0.35em] opacity-85';

export const attendeeEventCols = cn(
  'mt-6 grid grid-cols-1 gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_330px] min-[900px]:gap-9',
);

export const attendeeEventEyebrow =
  'text-[0.72rem] font-bold uppercase tracking-[0.12em] text-ink-muted';

export const attendeeEventOrg = 'm-0 mb-5 text-[1.05rem] text-ink-muted';

export const attendeeEventMainH1 = cn(
  'my-2 font-display text-[clamp(1.75rem,4vw,2.4rem)] leading-[1.15] tracking-[-0.03em]',
);

export const attendeeEventFacts = cn(
  'mb-5 grid grid-cols-1 gap-4 border-y border-line py-5 min-[900px]:grid-cols-2',
  '[&_small]:mb-[7px] [&_small]:block [&_small]:text-[0.68rem] [&_small]:font-bold [&_small]:uppercase [&_small]:tracking-[0.1em] [&_small]:text-muted',
  '[&_p]:m-0 [&_p]:font-semibold [&_p]:leading-[1.45] [&_p]:text-ink',
);

export const attendeeEventFactsTz = 'mt-1 block text-[0.85rem] font-normal text-muted';

export const attendeeEventProse = cn(
  '[&_h2]:m-0 [&_h2]:mb-3 [&_h2]:text-[clamp(1.25rem,2.5vw,1.45rem)]',
  '[&_h3]:my-5 [&_h3]:mb-3 [&_h3]:text-[1.05rem]',
  '[&_h4]:my-4 [&_h4]:mb-2 [&_h4]:text-base',
  '[&_p]:mb-3 [&_p]:leading-[1.65] [&_p]:text-muted',
);

export const attendeeEventMuted = 'text-muted';

export const attendeeEventSidebox = cn(
  'self-start rounded-2xl border border-[color-mix(in_srgb,var(--color-signal)_22%,var(--color-line))] p-6 max-md:p-5',
  'bg-gradient-to-br from-white from-0% via-[color-mix(in_srgb,var(--color-signal)_6%,white)] via-[48%] to-white to-100%',
  'shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-signal)_8%,transparent),var(--shadow-md)]',
  'min-[900px]:sticky min-[900px]:top-[5.75rem]',
  '[&_h2]:m-0 [&_h2]:mb-2.5 [&_h2]:font-display [&_h2]:text-[1.15rem] [&_h2]:tracking-[-0.02em]',
);

export const attendeeEventSideboxLead =
  'm-0 mb-4 text-[0.94rem] leading-[1.55] text-muted';

export const attendeeEventSideboxCta = cn(
  'mt-1 flex min-h-12 w-full justify-center rounded-md border-transparent',
  'bg-gradient-to-br from-signal from-0% to-[color-mix(in_srgb,var(--color-signal)_88%,var(--color-ink))] to-100%',
  'text-paper shadow-[0_10px_28px_color-mix(in_srgb,var(--color-signal)_28%,transparent)]',
);

export const attendeeEventSideboxHelp =
  'm-0 mt-4 text-[0.82rem] leading-[1.6] text-muted';

export const attendeeEventFaq = cn(
  'mt-[var(--spacing-3xl)] max-w-[48rem] border-t border-line pt-5',
  '[&_h2]:mb-3 [&_h2]:text-[clamp(1.25rem,2.5vw,1.45rem)]',
  '[&_summary]:cursor-pointer [&_summary]:font-bold [&_details_p]:mt-4',
);

/** Ticket detail */
export const attendeeTicketTitle = cn(
  'font-display text-[clamp(1.65rem,4vw,2rem)] tracking-[-0.03em]',
);

export const attendeeTicketBread = 'my-4 mb-2 text-[0.88rem]';

export const attendeeTicketBackLink = 'font-bold no-underline hover:underline';

export const attendeeTicketIntro = 'max-w-[570px] text-[1.15rem] leading-[1.65]';

export const attendeeTicketDetailCard = cn(
  'relative my-5 overflow-visible rounded-2xl border border-line bg-white shadow-md',
  'before:absolute before:left-[-11px] before:top-[42%] before:z-[2] before:h-5 before:w-5',
  'before:-translate-y-1/2 before:rounded-full before:border before:border-line before:bg-paper before:content-[""]',
  'after:absolute after:right-[-11px] after:top-[42%] after:z-[2] after:h-5 after:w-5',
  'after:-translate-y-1/2 after:rounded-full after:border after:border-line after:bg-paper after:content-[""]',
);

export const attendeeTicketCardHead =
  'border-b border-dashed border-[color-mix(in_srgb,var(--color-line)_85%,var(--color-muted))] bg-gradient-to-b from-[color-mix(in_srgb,var(--color-paper)_96%,white)] to-white px-5 py-4';

export const attendeeTicketCardBody = 'grid gap-4 p-5';

export const attendeeTicketQrPanel = cn(
  'm-0 rounded-md border border-line bg-gradient-to-b from-white to-[color-mix(in_srgb,var(--color-paper)_96%,white)] px-5 py-6 text-center',
  'shadow-[inset_0_0_0_4px_white,inset_0_0_0_5px_color-mix(in_srgb,var(--color-line)_80%,transparent)]',
  '[&_.ticket-qr]:mx-auto',
);

export const attendeeTicketQrCaption =
  'mt-3.5 mb-0 text-[0.88rem] leading-[1.45] text-muted';

export const attendeeTicketMetaList = cn(
  'm-0 grid gap-3 p-0',
  '[&>div]:grid [&>div]:gap-1 [&>div]:rounded-sm [&>div]:border [&>div]:border-[color-mix(in_srgb,var(--color-line)_90%,transparent)]',
  '[&>div]:bg-[color-mix(in_srgb,var(--color-paper)_92%,var(--color-focus)_8%)] [&>div]:px-3.5 [&>div]:py-3',
  '[&_dt]:text-[0.68rem] [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-[0.08em] [&_dt]:text-muted',
  '[&_dd]:m-0 [&_dd]:text-[0.95rem] [&_dd]:font-semibold',
  '[&_code]:font-mono [&_code]:text-[0.92rem] [&_code]:tracking-[0.04em]',
);

export const attendeeTicketNoticeBase = 'my-4 border-2 px-5 py-4';

export const attendeeTicketNoticeError = cn(
  attendeeTicketNoticeBase,
  'border-[color-mix(in_srgb,var(--color-destructive)_55%,transparent)] bg-[color-mix(in_srgb,var(--color-destructive)_12%,var(--color-paper))] text-destructive',
  '[&_p]:mb-0',
);

export const attendeeTicketNoticeUnknown = cn(
  attendeeTicketNoticeBase,
  'border-[color-mix(in_srgb,var(--color-ink)_55%,var(--color-muted))] bg-[color-mix(in_srgb,var(--color-paper)_88%,var(--color-ink))] text-[color-mix(in_srgb,var(--color-ink)_88%,var(--color-muted))]',
  '[&_p]:mb-0',
);

export const attendeeTicketStateTagBase =
  'inline-flex items-center rounded-[5px] px-2 py-[5px] text-[0.68rem] font-bold tracking-[0.02em]';

export function attendeeTicketStateTag(state: string): string {
  if (state === 'ACTIVE') {
    return cn(
      attendeeTicketStateTagBase,
      'bg-[color-mix(in_srgb,var(--color-admit)_12%,var(--color-paper))] text-admit',
    );
  }
  if (state === 'USED' || state === 'CHECKED_IN') {
    return cn(
      attendeeTicketStateTagBase,
      'bg-[color-mix(in_srgb,var(--color-focus)_10%,var(--color-paper))] text-[color-mix(in_srgb,var(--color-ink)_45%,var(--color-muted))]',
    );
  }
  if (state === 'REVOKED' || state === 'EXPIRED') {
    return cn(
      attendeeTicketStateTagBase,
      'bg-[color-mix(in_srgb,var(--color-signal)_12%,var(--color-paper))] text-[color-mix(in_srgb,var(--color-destructive)_75%,var(--color-signal))]',
    );
  }
  return attendeeTicketStateTagBase;
}

/** Wallet */
export const attendeeWalletPage = cn(attendeeDetailMain, 'pb-10 [--brand:var(--color-signal)]');

export const attendeeWalletHeading = cn(
  'my-7 mb-[22px] flex flex-wrap items-end justify-between gap-5 max-md:mt-[22px] max-md:flex-col max-md:items-start',
  '[&_h1]:m-0 [&_h1]:mb-2 [&_h1]:font-display [&_h1]:text-[clamp(1.85rem,4vw,2.35rem)] [&_h1]:tracking-[-0.04em]',
);

export const attendeeWalletIntro =
  'm-0 max-w-[36rem] text-[1.02rem] leading-[1.6] text-ink-muted';

export const attendeeWalletHeadingCta = cn(
  'min-h-11 shrink-0 rounded-md shadow-[0_8px_24px_color-mix(in_srgb,var(--color-signal)_22%,transparent)]',
);

export const attendeeWalletGrid = cn(
  'mb-10 grid grid-cols-1 gap-[18px] min-[768px]:grid-cols-2 min-[768px]:gap-[22px]',
);

export const attendeeWalletFilters =
  'mb-5 flex flex-wrap items-center gap-2';

export function attendeeWalletFilterChip(active: boolean) {
  return cn(
    'inline-flex min-h-11 items-center gap-2.5 rounded-md border px-3 py-2 text-[0.82rem] font-semibold no-underline',
    'bg-[color-mix(in_srgb,var(--color-focus)_10%,var(--color-paper))] text-ink',
    !active && 'border-transparent hover:border-line',
    active &&
      'border-line bg-white shadow-[inset_0_-2px_var(--color-signal)]',
  );
}

export const attendeeWalletFilterCount =
  'text-[0.72rem] font-bold text-[color-mix(in_srgb,var(--color-ink)_70%,var(--color-muted))]';

export const attendeeWalletTicketCard = cn(
  'relative flex flex-col overflow-visible rounded-2xl border border-line bg-white text-inherit no-underline shadow-sm',
  'transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-[border-color]',
  'before:pointer-events-none before:absolute before:left-[-10px] before:top-[62%] before:z-[2]',
  'before:h-[18px] before:w-[18px] before:-translate-y-1/2 before:rounded-full before:border before:border-line before:bg-paper before:content-[""]',
  'after:pointer-events-none after:absolute after:right-[-10px] after:top-[62%] after:z-[2]',
  'after:h-[18px] after:w-[18px] after:-translate-y-1/2 after:rounded-full after:border after:border-line after:bg-paper after:content-[""]',
  'hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--color-signal)_28%,var(--color-line))] hover:shadow-md motion-reduce:hover:translate-y-0',
);

export const attendeeWalletTicketCardDisabled = cn(
  attendeeWalletTicketCard,
  'cursor-not-allowed opacity-[0.94] pointer-events-none hover:translate-y-0 hover:shadow-sm',
);

export const attendeeWalletTicketTop =
  'border-b border-dashed border-[color-mix(in_srgb,var(--color-line)_85%,var(--color-muted))] bg-gradient-to-b from-[color-mix(in_srgb,var(--color-paper)_96%,white)] to-white px-5 py-[18px]';

export const attendeeWalletTicketHead =
  'flex items-center justify-between gap-3';

export const attendeeWalletTicketDate =
  'text-[0.78rem] tabular-nums text-muted';

export const attendeeWalletTicketTitle = cn(
  'my-2.5 mb-2 font-display text-[1.08rem] font-bold leading-[1.25] tracking-[-0.02em]',
);

export const attendeeWalletTicketMeta = cn(
  'm-0 text-[0.88rem] leading-[1.5] text-muted',
  '[&_code]:font-mono [&_code]:text-[0.92em] [&_code]:font-semibold [&_code]:tracking-[0.04em] [&_code]:text-ink',
);

export const attendeeWalletTicketFoot = cn(
  'flex min-h-12 items-center justify-between gap-3 border-t border-dashed border-[color-mix(in_srgb,var(--color-line)_85%,var(--color-muted))] px-5 py-3.5 text-[0.8rem]',
);

export const attendeeWalletTicketCode = cn(
  'font-mono font-semibold uppercase tracking-[0.06em] text-muted',
);

export const attendeeWalletTicketCta = cn(
  'text-[0.85rem] font-bold text-[color-mix(in_srgb,var(--color-focus)_55%,var(--color-ink))]',
);

export const attendeeWalletTicketWarn =
  'm-0 px-5 pb-[18px] pt-3 text-[0.82rem] leading-[1.5] text-muted';
