import { cn } from '../../lib/utils';

/**
 * Redeem route (/redeem) — Tailwind v4 + tokens; replaces redeem-surface.module.css.
 *
 * D-1: no raw #hex — color-mix on @theme semantic tokens.
 * Dev / tenant-bound tooling keeps legacy `.redeem-form` classes from live-pulse-legacy.
 */

export const redeemPageMain = cn(
  'lp-container shell [--brand:var(--color-signal)]',
);

export const redeemNarrow = 'mx-auto mb-12 max-w-[33.125rem]';

export const redeemHeader = cn(
  'mt-8 text-left animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both motion-reduce:animate-none',
  '[&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-[clamp(1.85rem,4.5vw,2.4rem)] [&_h1]:tracking-[-0.04em]',
  'max-[480px]:[&_h1]:text-[1.75rem]',
);

export const redeemLead =
  'm-0 max-w-[32rem] text-[1.05rem] leading-[1.65] text-ink-muted';

export const redeemGateCard = cn(
  'mt-8 rounded-lg border border-line bg-white p-6 shadow-[0_1px_0_color-mix(in_srgb,var(--color-ink)_4%,transparent)]',
  'max-[480px]:p-5',
  '[&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-[clamp(1.25rem,2.8vw,1.55rem)]',
  '[&_p]:m-0 [&_p]:mb-4 [&_p]:leading-[1.6] [&_p]:text-ink-muted',
);

export const redeemGateIllustration = cn(
  'mb-4 grid h-14 w-14 place-items-center rounded-[14px] border text-2xl',
  'border-[color-mix(in_srgb,var(--color-focus)_35%,var(--color-line))]',
  'bg-gradient-to-br from-[color-mix(in_srgb,var(--color-focus)_8%,white)] to-[color-mix(in_srgb,var(--color-focus)_4%,var(--color-paper))]',
  'text-[color-mix(in_srgb,var(--color-focus)_88%,var(--color-ink))]',
);

export const redeemGateActions = 'grid gap-3 [&_a]:w-full [&_a]:text-center';

export const redeemFormCard = cn(
  'mt-8 rounded-lg border border-line bg-white p-6 shadow-[0_1px_0_color-mix(in_srgb,var(--color-ink)_4%,transparent)]',
  'max-[480px]:p-5',
);

export const redeemFooterLinks = 'mt-8 text-[0.95rem]';

export const redeemProductFormRoot = 'redeem-form redeem-product-form m-0 grid max-w-none gap-8';

export const redeemProductFormTitle = cn(
  'absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap',
  '[clip:rect(0,0,0,0)]',
);

export const redeemProductLead = 'm-0 text-[0.95rem] leading-[1.55] text-ink-muted';

export const redeemCodeField = cn(
  'grid gap-2',
  '[&_label]:text-xs [&_label]:font-bold [&_label]:tracking-[0.02em]',
  '[&_input]:box-border [&_input]:min-h-[46px] [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[color-mix(in_srgb,var(--color-ink)_14%,var(--color-line))] [&_input]:bg-white [&_input]:px-3.5 [&_input]:py-3 [&_input]:font-[inherit]',
  '[&_input:focus-visible]:outline [&_input:focus-visible]:outline-[3px] [&_input:focus-visible]:outline-focus [&_input:focus-visible]:outline-offset-2',
);

export const redeemPrimaryActions = cn(
  'grid gap-3 [&_.redeem-submit]:w-full [&_.redeem-submit]:rounded-md',
);

export const redeemSecondaryTools = cn(
  'mt-2 [&_summary]:flex [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:items-center [&_summary]:font-semibold [&_summary]:text-ink-muted',
);

export const redeemGlobalContext = cn(
  'rounded-md border border-line bg-[color-mix(in_srgb,var(--color-paper)_92%,var(--color-focus)_8%)] p-4',
  '[&_h3]:m-0 [&_h3]:mb-3 [&_h3]:text-base',
  '[&_dl]:m-0 [&_dl]:grid [&_dl]:gap-2',
  '[&_dt]:text-[0.72rem] [&_dt]:uppercase [&_dt]:tracking-[0.06em] [&_dt]:text-ink-muted',
  '[&_dd]:m-0 [&_dd]:font-semibold',
);

export const redeemPublishedFieldsCompact = cn(
  'redeem-published-fields redeem-published-fields--compact gap-3 rounded-md border border-line p-4',
);

export const redeemPublishedLegend =
  'redeem-published-fields__legend text-xs font-bold tracking-[0.04em] uppercase text-ink-muted';

export const redeemFieldLabel = cn(
  'redeem-field-label grid gap-2 text-xs font-bold',
  '[&_input]:min-h-[46px] [&_input]:rounded-md [&_input]:border [&_input]:border-[color-mix(in_srgb,var(--color-ink)_14%,var(--color-line))]',
  '[&_select]:min-h-[46px] [&_select]:rounded-md [&_select]:border [&_select]:border-[color-mix(in_srgb,var(--color-ink)_14%,var(--color-line))]',
);

export const redeemTermsProduct = cn(
  'redeem-terms mt-2 gap-3 rounded-md border border-line bg-paper p-[18px]',
  '[&_.redeem-terms-body]:max-h-[140px] [&_.redeem-terms-body]:rounded-sm [&_.redeem-terms-body]:border [&_.redeem-terms-body]:border-line [&_.redeem-terms-body]:bg-white [&_.redeem-terms-body]:p-3.5 [&_.redeem-terms-body]:text-[0.85rem] [&_.redeem-terms-body]:leading-[1.55]',
  '[&_.redeem-checkbox]:items-start [&_.redeem-checkbox]:text-[0.88rem] [&_.redeem-checkbox]:leading-[1.45]',
);

export const redeemTicketCard = cn(
  'redeem-ticket mt-8 rounded-lg border border-dashed border-[color-mix(in_srgb,var(--color-line)_85%,var(--color-muted))] bg-gradient-to-b from-[color-mix(in_srgb,var(--color-paper)_96%,white)] to-white p-5',
);

export const redeemOutcomePanel = cn(
  'mt-8 rounded-lg border border-line bg-white px-6 py-7 text-center shadow-sm',
  '[&_h3]:m-0 [&_h3]:mb-2.5 [&_h3]:font-display [&_h3]:text-[clamp(1.35rem,3vw,1.65rem)] [&_h3]:tracking-[-0.03em]',
  '[&_p]:m-0 [&_p]:mb-4 [&_p]:text-[0.98rem] [&_p]:leading-[1.6] [&_p]:text-ink-muted',
  '[&_.auth-buttons]:flex [&_.auth-buttons]:flex-wrap [&_.auth-buttons]:justify-center',
);

export const redeemOutcomeSuccess = cn(
  'border-[color-mix(in_srgb,var(--color-admit)_45%,var(--color-line))]',
  'bg-gradient-to-b from-white from-0% to-[color-mix(in_srgb,var(--color-admit)_8%,white)] to-100%',
);

export const redeemOutcomeError = cn(
  'border-[color-mix(in_srgb,var(--color-destructive)_35%,var(--color-line))] text-left',
  'bg-gradient-to-b from-white from-0% to-[color-mix(in_srgb,var(--color-destructive)_6%,white)] to-100%',
);

export const redeemSuccessRing = cn(
  'mx-auto mb-[18px] grid h-[88px] w-[88px] place-items-center rounded-full border-2 text-[2rem] font-bold leading-none',
  'border-[color-mix(in_srgb,var(--color-admit)_55%,var(--color-paper))] bg-[color-mix(in_srgb,var(--color-admit)_12%,var(--color-paper))] text-admit',
  'animate-in zoom-in-95 duration-400 fill-mode-both motion-reduce:animate-none',
);

export const redeemErrorRing = cn(
  'mb-3.5 mr-auto grid h-[88px] w-[88px] place-items-center rounded-full border-2 text-[2rem] font-bold leading-none',
  'border-[color-mix(in_srgb,var(--color-destructive)_35%,var(--color-paper))] bg-[color-mix(in_srgb,var(--color-destructive)_8%,var(--color-paper))] text-destructive',
);

export const redeemOutcomeActions = cn(
  'mt-4 grid gap-3',
  '[&_.button]:min-h-12 [&_.button]:w-full [&_.button]:justify-center',
  '[&_a.button]:min-h-12 [&_a.button]:w-full [&_a.button]:justify-center',
);

const PRODUCT_ERROR_KINDS = new Set([
  'error',
  'invalid',
  'exhausted',
  'used',
  'closed',
  'denied',
  'conflict',
]);

/** Product chrome UX panel — Tailwind only (no legacy redeem-status--* modifiers). */
export function redeemProductUxClass(kind: string): string {
  const base = cn('redeem-status', redeemOutcomePanel);
  if (kind === 'success') {
    return cn(base, redeemOutcomeSuccess);
  }
  if (PRODUCT_ERROR_KINDS.has(kind)) {
    return cn(base, redeemOutcomeError);
  }
  return base;
}

export function redeemProductErrorOutcome(kind: string): boolean {
  return PRODUCT_ERROR_KINDS.has(kind);
}
