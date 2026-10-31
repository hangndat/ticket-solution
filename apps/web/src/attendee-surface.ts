import { cn } from '../lib/utils';

/** Attendee product shell (Tailwind v4 / @theme — replaces attendee-uplift.css). */

export const attendeeBody = cn(
  'flex min-h-dvh flex-col overflow-x-clip text-[15px] leading-[1.55] antialiased scheme-light',
  '[&>main]:min-w-0 [&>main]:w-full [&>main]:flex-1',
);

export const attendeeSkip =
  'skip-link absolute -left-[9999px] top-0 z-[100] rounded-sm bg-ink px-4 py-3 text-paper focus:left-4 focus:top-4';

export const attendeeFooter = cn(
  'mx-auto mt-[var(--spacing-4xl)] flex w-full max-w-[1200px] shrink-0 flex-nowrap items-center justify-between gap-x-5 gap-y-3 border-t border-line px-[var(--spacing-2xl)] py-6 text-[0.68rem] tracking-[0.06em] text-muted max-sm:flex-wrap',
  '[&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:font-semibold [&_a]:text-ink [&_a]:no-underline hover:[&_a]:text-ink',
);

export const attendeeFooterTagline =
  'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-muted max-sm:basis-full max-sm:whitespace-normal';

export const attendeeFooterLinks =
  'flex flex-none flex-nowrap items-center gap-x-[18px] gap-y-3 max-sm:flex-wrap';

export const attendeeFooterBrand = cn(
  'font-display text-[1.35rem] font-bold tracking-[-0.06em] text-ink',
  '[&_span]:text-signal',
);

/** Light paper wash — product routes only (not marketing neon). */
export const attendeeProductAtmosphere = cn(
  'relative bg-paper',
  'bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,color-mix(in_srgb,var(--color-signal)_7%,transparent),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,color-mix(in_srgb,var(--color-focus)_6%,transparent),transparent_50%)]',
);

export const attendeeHomeMain = cn(
  attendeeProductAtmosphere,
  'mx-auto w-full max-w-[1200px] px-[var(--spacing-2xl)] pt-0',
  'flex flex-col min-w-0',
);

export const attendeeSiteHeader = cn(
  'sticky top-0 z-50 border-b border-line bg-paper/92 backdrop-blur-md',
);

export const attendeeTopNav = cn(
  'mx-auto flex max-w-[1200px] flex-nowrap items-center justify-between gap-4 px-[var(--spacing-2xl)] text-[0.88rem] min-h-[72px] max-md:min-h-[62px] max-md:px-4',
  '[&_a]:font-semibold [&_a]:no-underline',
);

export const attendeeWordmark = cn(
  'inline-flex items-center gap-2 font-display text-[1.35rem] font-bold tracking-[-0.06em] text-ink no-underline',
  '[&_span]:text-signal',
);

export const attendeeBrandMark = 'size-8 shrink-0 text-ink';
export const attendeeBrandMarkImg = 'size-8 shrink-0 object-contain';

export const attendeeNavLinksDesktop =
  'ml-4 flex min-w-0 flex-1 flex-nowrap items-center justify-start gap-1 overflow-x-auto max-md:hidden';

export function attendeeNavLink(active: boolean) {
  return cn(
    'inline-flex min-h-11 items-center justify-center rounded-md px-3.5 font-medium text-muted no-underline transition-colors motion-reduce:transition-none',
    'hover:bg-ink/[0.04] hover:text-ink',
    active && 'font-semibold text-ink shadow-[inset_0_-2px_0_var(--color-signal)]',
  );
}

export const attendeeNavAvatar = cn(
  'hidden min-h-11 items-center gap-2.5 rounded-md px-1.5 text-ink no-underline md:inline-flex',
);

export const attendeeNavAvatarBadge = cn(
  'grid size-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-signal)_14%,var(--color-paper))] text-[0.68rem] font-bold text-[color-mix(in_srgb,var(--color-ink)_28%,var(--color-signal))]',
);

export const attendeeNavAvatarLabel =
  'hidden max-w-40 overflow-hidden text-ellipsis whitespace-nowrap text-[0.82rem] font-semibold xl:inline';

export const attendeeNavMenuToggle = cn(
  'ml-auto inline-flex min-h-11 min-w-11 items-center gap-2 rounded-md border border-line bg-paper px-3 font-semibold text-ink md:hidden',
);

export const attendeeSheetNav = 'grid gap-1 overflow-y-auto p-4 motion-reduce:animate-none motion-reduce:transition-none';

export function attendeeSheetNavLink(active: boolean) {
  return cn(
    attendeeNavLink(active),
    'w-full justify-start shadow-none',
    active &&
      'bg-[color-mix(in_srgb,var(--color-focus)_8%,var(--color-paper))] shadow-[inset_3px_0_0_var(--color-signal)]',
  );
}

export const attendeeNotice = cn(
  'my-9 border border-current bg-paper/40 p-6',
  '[&_h2]:text-[1.2rem] [&_h2]:tracking-normal [&_p]:mb-0',
);

export const attendeeNoticeError = cn(
  attendeeNotice,
  'border-destructive/55 bg-destructive/10 text-destructive',
);

export const attendeeAuthButtons = 'my-4 flex flex-wrap gap-3';

export const attendeeHomeCatalog = 'mt-[var(--spacing-2xl)]';

export const attendeeHomeCatalogTools = cn(
  'mb-[var(--spacing-2xl)] flex flex-wrap items-stretch gap-3 rounded-2xl border border-line bg-paper p-[18px] shadow-[0_1px_2px_rgba(11,18,32,0.06)]',
);

export const attendeeHomeCatalogSearch = 'relative block min-w-[220px] flex-[1_1_220px]';

export const attendeeHomeCatalogSearchIcon =
  'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[1.1rem] opacity-45';

export const attendeeHomeCatalogSearchInput = cn(
  'w-full min-h-12 rounded-md border border-line bg-paper py-3 pl-[42px] pr-3.5 font-[inherit] text-ink',
  'transition-[border-color,box-shadow] motion-reduce:transition-none',
  'focus:border-focus focus:outline-none focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)]',
);

export const attendeeHomeCatalogFilters = 'flex flex-wrap items-center gap-2';

export const attendeeHomeCatalogEmpty = cn(
  'grid gap-3 rounded-2xl border border-solid border-line bg-paper p-[var(--spacing-2xl)] text-center shadow-[0_1px_2px_rgba(11,18,32,0.06)]',
);

export const attendeeHomeCatalogEmptyAction = 'flex justify-center';

export const attendeeHomeCatalogGrid = cn(
  'grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-3',
);

export const attendeeCatalogOwnedStrip = cn(
  'mt-2.5 flex min-h-11 w-full items-center justify-between gap-2.5 rounded-md bg-[color-mix(in_srgb,var(--color-focus)_10%,var(--color-paper))] px-3.5 py-2.5 text-[0.8rem] font-semibold text-[color-mix(in_srgb,var(--color-focus)_75%,var(--color-ink))] no-underline',
);

export const attendeeRouteLoadingShell = 'py-[var(--spacing-3xl)]';
