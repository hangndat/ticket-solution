import { cn } from '../../lib/utils';
import { attendeeProductAtmosphere } from '../attendee-surface';

/**
 * Redeem route (/redeem) + shared guest-flow primitives — Tailwind v4 + @theme tokens (D-1).
 */

export const fadeRiseMotion = cn(
  'motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-reduce:animate-none',
);

export const lpPageShell = cn(
  'mx-auto max-w-[75rem] px-5 [--brand:var(--color-signal)]',
  'min-h-[75vh] pb-[60px]',
  'min-[760px]:px-12 min-[760px]:pb-[70px]',
);

export const redeemPageMain = cn(
  attendeeProductAtmosphere,
  lpPageShell,
  '[--brand:var(--color-signal)]',
);

export const redeemEyebrow = cn(
  'm-0 mb-2 text-[0.75rem] font-bold uppercase tracking-[0.14em] text-signal',
);

export const introLead = 'max-w-[570px] text-[1.15rem] leading-[1.65]';

export const redeemNarrow = 'mx-auto mb-12 max-w-[33.125rem]';

export const redeemHeader = cn(
  'mt-8 text-left',
  '[&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-[clamp(1.85rem,4.5vw,2.4rem)] [&_h1]:tracking-[-0.04em]',
  'max-[480px]:[&_h1]:text-[1.75rem]',
  fadeRiseMotion,
);

export const redeemLead =
  'm-0 max-w-[32rem] text-[1.05rem] leading-[1.65] text-muted';

export const authButtonsRow = cn(
  'my-4 flex flex-wrap gap-3',
  '[&_button]:box-border [&_button]:min-h-11 [&_button]:min-w-11',
  '[&_a]:box-border [&_a]:inline-flex [&_a]:min-h-11 [&_a]:min-w-11 [&_a]:items-center',
);

export const redeemAuthNotice = cn(
  'my-9 border border-destructive/55 bg-destructive/10 p-6 text-destructive',
  '[&_h2]:text-xl [&_h2]:tracking-normal [&_p]:mb-0',
);

export const redeemGateCard = cn(
  'mt-8 rounded-lg border border-line bg-white p-6 shadow-[0_1px_0_color-mix(in_srgb,var(--color-ink)_4%,transparent)]',
  'max-[480px]:p-5',
  '[&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-[clamp(1.25rem,2.8vw,1.55rem)]',
  '[&_p]:m-0 [&_p]:mb-4 [&_p]:leading-[1.6] [&_p]:text-muted',
);

export const redeemGateActions = 'grid gap-3 [&_a]:w-full [&_a]:text-center';

export const redeemFormCard = cn(
  'mt-8 rounded-lg border border-line bg-white p-6 shadow-[0_1px_0_color-mix(in_srgb,var(--color-ink)_4%,transparent)]',
  'max-[480px]:p-5',
);

const devFormFieldChrome = cn(
  '[&_label]:grid [&_label]:gap-1.5 [&_label]:text-sm [&_label]:font-bold',
  '[&_input:not([type=checkbox]):not([type=radio])]:box-border [&_input:not([type=checkbox]):not([type=radio])]:min-h-11 [&_input:not([type=checkbox]):not([type=radio])]:w-full [&_input:not([type=checkbox]):not([type=radio])]:rounded-md [&_input:not([type=checkbox]):not([type=radio])]:border-2 [&_input:not([type=checkbox]):not([type=radio])]:border-[color-mix(in_srgb,var(--color-ink)_25%,transparent)] [&_input:not([type=checkbox]):not([type=radio])]:bg-white [&_input:not([type=checkbox]):not([type=radio])]:px-3.5 [&_input:not([type=checkbox]):not([type=radio])]:py-3 [&_input:not([type=checkbox]):not([type=radio])]:font-[inherit] [&_input:not([type=checkbox]):not([type=radio])]:font-normal [&_input:not([type=checkbox]):not([type=radio])]:text-ink',
  '[&_select]:box-border [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-md [&_select]:border-2 [&_select]:border-[color-mix(in_srgb,var(--color-ink)_25%,transparent)] [&_select]:bg-white [&_select]:px-3.5 [&_select]:py-3 [&_select]:font-[inherit]',
  '[&_textarea]:box-border [&_textarea]:min-h-11 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border-2 [&_textarea]:border-[color-mix(in_srgb,var(--color-ink)_25%,transparent)] [&_textarea]:bg-white [&_textarea]:px-3.5 [&_textarea]:py-3 [&_textarea]:font-[inherit] [&_textarea]:font-normal',
  '[&_textarea[readonly]]:bg-[color-mix(in_srgb,var(--color-ink)_5%,transparent)]',
  '[&_input:disabled]:cursor-not-allowed [&_input:disabled]:opacity-50 [&_select:disabled]:cursor-not-allowed [&_select:disabled]:opacity-50 [&_textarea:disabled]:cursor-not-allowed [&_textarea:disabled]:opacity-50',
  '[&_input[aria-invalid=true]]:border-destructive [&_select[aria-invalid=true]]:border-destructive [&_textarea[aria-invalid=true]]:border-destructive',
  '[&_input:focus-visible]:outline-none [&_input:focus-visible]:ring-[3px] [&_input:focus-visible]:ring-focus [&_input:focus-visible]:ring-offset-2 [&_input:focus-visible]:ring-offset-paper',
  '[&_select:focus-visible]:outline-none [&_select:focus-visible]:ring-[3px] [&_select:focus-visible]:ring-focus [&_select:focus-visible]:ring-offset-2 [&_select:focus-visible]:ring-offset-paper',
  '[&_textarea:focus-visible]:outline-none [&_textarea:focus-visible]:ring-[3px] [&_textarea:focus-visible]:ring-focus [&_textarea:focus-visible]:ring-offset-2 [&_textarea:focus-visible]:ring-offset-paper',
  '[&_button]:min-h-11 [&_button]:min-w-11',
);

export const redeemDevFormRoot = cn('my-8 grid max-w-[45rem] gap-7', devFormFieldChrome);

export const guestFormRoot = redeemDevFormRoot;

export const redeemProductFormRoot = cn(
  'redeem-product-form m-0 grid max-w-none gap-8',
  devFormFieldChrome,
);

export const redeemProductFormTitle = cn(
  'absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap',
  '[clip:rect(0,0,0,0)]',
);

export const redeemProductLead = 'm-0 text-[0.95rem] leading-[1.55] text-muted';

export const redeemCodeField = cn(
  'grid gap-2',
  '[&_label]:text-xs [&_label]:font-bold [&_label]:tracking-[0.02em]',
  '[&_input]:box-border [&_input]:min-h-[46px] [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[color-mix(in_srgb,var(--color-ink)_14%,var(--color-line))] [&_input]:bg-white [&_input]:px-3.5 [&_input]:py-3 [&_input]:font-[inherit]',
  '[&_input:focus-visible]:outline [&_input:focus-visible]:outline-[3px] [&_input:focus-visible]:outline-focus [&_input:focus-visible]:outline-offset-2',
);

export const redeemPrimaryActions = cn('grid gap-3 [&_.redeem-submit]:w-full [&_.redeem-submit]:rounded-md');

export const redeemSecondaryTools = cn(
  'mt-2 [&_summary]:flex [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:items-center [&_summary]:font-semibold [&_summary]:text-muted',
);

export const redeemGlobalContext = cn(
  'rounded-md border border-line bg-[color-mix(in_srgb,var(--color-paper)_92%,var(--color-focus)_8%)] p-4',
  '[&_h3]:m-0 [&_h3]:mb-3 [&_h3]:text-base',
  '[&_dl]:m-0 [&_dl]:grid [&_dl]:gap-2',
  '[&_dt]:text-[0.72rem] [&_dt]:uppercase [&_dt]:tracking-[0.06em] [&_dt]:text-muted',
  '[&_dd]:m-0 [&_dd]:font-semibold',
);

export const redeemFieldsGrid = 'grid gap-4';

export const redeemVersionsGrid = cn(
  'grid gap-4 min-[760px]:grid-cols-2',
  '[&_label]:grid [&_label]:gap-1.5 [&_label]:text-sm [&_label]:font-bold',
  '[&_input]:min-h-11 [&_input]:rounded-md [&_input]:border-2 [&_input]:border-[color-mix(in_srgb,var(--color-ink)_25%,transparent)] [&_input]:bg-white [&_input]:px-3.5 [&_input]:py-3',
  '[&_input:focus-visible]:outline-none [&_input:focus-visible]:ring-[3px] [&_input:focus-visible]:ring-focus [&_input:focus-visible]:ring-offset-2 [&_input:focus-visible]:ring-offset-paper',
);

export const redeemPublishedFields = cn(
  'm-0 grid gap-3.5 border-2 border-[color-mix(in_srgb,var(--color-ink)_19%,transparent)] p-4',
  devFormFieldChrome,
);

export const redeemPublishedFieldsCompact = cn(
  'gap-3 rounded-md border border-line p-4',
  redeemPublishedFields,
);

export const redeemPublishedLegend =
  'px-1.5 text-xs font-bold tracking-[0.04em] uppercase text-muted';

export const redeemFieldStack = 'grid gap-1.5';

export const redeemFieldLabel = cn(
  'grid gap-2 text-xs font-bold',
  '[&_input]:min-h-[46px] [&_input]:rounded-md [&_input]:border [&_input]:border-[color-mix(in_srgb,var(--color-ink)_14%,var(--color-line))]',
  '[&_select]:min-h-[46px] [&_select]:rounded-md [&_select]:border [&_select]:border-[color-mix(in_srgb,var(--color-ink)_14%,var(--color-line))]',
);

export const redeemCheckboxRow = cn(
  'flex min-h-11 items-center gap-2.5 font-semibold',
  '[&_input]:m-0 [&_input]:size-5 [&_input]:min-h-5 [&_input]:min-w-5 [&_input]:shrink-0',
);

export const redeemFieldError = 'm-0 text-sm font-semibold text-destructive';

export const redeemSchemaNotice = 'm-0 text-sm text-muted';

export const redeemTermsBlock = cn(
  'm-0 grid gap-3.5 border-2 border-[color-mix(in_srgb,var(--color-ink)_19%,transparent)] p-4',
);

export const redeemTermsBody = cn(
  'm-0 max-h-[180px] overflow-auto whitespace-pre-wrap border border-[color-mix(in_srgb,var(--color-ink)_19%,transparent)] bg-[color-mix(in_srgb,var(--color-ink)_5%,transparent)] p-3 text-sm',
);

export const redeemTermsProduct = cn(
  'mt-2 gap-3 rounded-md border border-line bg-paper p-[18px]',
  redeemTermsBlock,
  '[&_[data-terms-body]]:max-h-[140px] [&_[data-terms-body]]:rounded-sm [&_[data-terms-body]]:border [&_[data-terms-body]]:border-line [&_[data-terms-body]]:bg-white [&_[data-terms-body]]:p-3.5 [&_[data-terms-body]]:text-[0.85rem] [&_[data-terms-body]]:leading-[1.55]',
);

export const redeemMetaDetails = cn(
  'mt-2.5 break-all text-sm',
  '[&_summary]:cursor-pointer [&_summary]:font-bold',
);

export const meResultPre = cn(
  'm-0 max-h-80 overflow-auto border border-[color-mix(in_srgb,var(--color-ink)_19%,transparent)] bg-[color-mix(in_srgb,var(--color-ink)_5%,transparent)] p-4 text-sm',
);

export const redeemDevTicketCard = cn(
  'mt-8 rounded-lg border border-dashed border-line bg-[color-mix(in_srgb,var(--color-ink)_5%,transparent)] p-5',
  '[&_dl]:m-0 [&_dl]:grid [&_dl]:gap-2.5',
  '[&_dl>div]:grid [&_dl>div]:grid-cols-[160px_1fr] [&_dl>div]:gap-3',
  '[&_dt]:text-sm [&_dt]:font-bold',
  '[&_dd]:m-0 [&_dd]:break-all [&_dd]:font-mono [&_dd]:text-sm',
);

export const redeemTicketListSection = cn(
  '[&_ul]:m-0 [&_ul]:grid [&_ul]:list-none [&_ul]:gap-2 [&_ul]:p-0',
  '[&_li]:border [&_li]:border-[color-mix(in_srgb,var(--color-ink)_19%,transparent)] [&_li]:bg-[color-mix(in_srgb,var(--color-ink)_5%,transparent)] [&_li]:px-3 [&_li]:py-2.5 [&_li]:text-sm',
);

export const redeemTicketCard = cn(
  'mt-8 rounded-lg border border-dashed border-[color-mix(in_srgb,var(--color-line)_85%,var(--color-muted))] bg-gradient-to-b from-[color-mix(in_srgb,var(--color-paper)_96%,white)] to-white p-5',
  '[&_dl]:m-0 [&_dl]:grid [&_dl]:gap-2.5',
  '[&_dl>div]:grid [&_dl>div]:grid-cols-[160px_1fr] [&_dl>div]:gap-3',
  '[&_dt]:text-sm [&_dt]:font-bold',
  '[&_dd]:m-0 [&_dd]:break-all [&_dd]:font-mono [&_dd]:text-sm',
);

const devStatusBase = cn(
  'grid gap-2 border-2 px-5 py-[18px]',
  'border-[color-mix(in_srgb,var(--color-ink)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-ink)_3%,transparent)]',
  '[&_h2]:m-0 [&_h2]:mb-2 [&_h2]:text-[1.15rem] [&_h3]:m-0 [&_h3]:mb-2 [&_h3]:text-[1.15rem]',
  '[&_p]:m-0',
  '[&_button]:min-h-11 [&_button]:min-w-11',
);

const devStatusSuccess = cn(
  'border-[color-mix(in_srgb,var(--color-ink)_55%,var(--color-focus)_45%)] bg-[color-mix(in_srgb,var(--color-paper)_88%,var(--color-focus)_12%)] text-ink',
);

const devStatusSignal = cn(
  'border-[color-mix(in_srgb,var(--color-signal)_45%,var(--color-ink))] bg-[color-mix(in_srgb,var(--color-signal)_10%,var(--color-paper))] text-ink',
);

const devStatusFocus = cn(
  'border-focus bg-[color-mix(in_srgb,var(--color-focus)_12%,var(--color-paper))] text-[color-mix(in_srgb,var(--color-focus)_70%,var(--color-ink))]',
);

const devStatusDestructive =
  'border-destructive/80 bg-destructive/10 text-destructive';

const devStatusPending = cn(
  'border-[color-mix(in_srgb,var(--color-focus)_50%,var(--color-ink))] bg-[color-mix(in_srgb,var(--color-focus)_12%,var(--color-paper))] text-ink',
);

const devStatusMuted = cn(
  'border-ink/40 bg-[color-mix(in_srgb,var(--color-ink)_8%,var(--color-paper))] text-ink',
);

const DEV_STATUS_KIND: Record<string, string> = {
  success: devStatusSuccess,
  exhausted: devStatusSignal,
  used: devStatusSignal,
  closed: devStatusSignal,
  timeout: devStatusFocus,
  polling: devStatusFocus,
  verifying: devStatusFocus,
  auth: devStatusDestructive,
  error: devStatusDestructive,
  invalid: devStatusDestructive,
  conflict: devStatusDestructive,
  denied: devStatusDestructive,
  stale: devStatusDestructive,
  pending: devStatusPending,
  expired: devStatusMuted,
  unknown: devStatusMuted,
};

/** Dev / tenant-bound redeem UX panels (legacy redeem-status parity). */
export function redeemDevStatusClass(kind: string): string {
  const variant = DEV_STATUS_KIND[kind] ?? DEV_STATUS_KIND.unknown;
  return cn(devStatusBase, variant);
}

export const redeemOutcomePanel = cn(
  'mt-8 rounded-lg border border-line bg-white px-6 py-7 text-center shadow-sm',
  '[&_h3]:m-0 [&_h3]:mb-2.5 [&_h3]:font-display [&_h3]:text-[clamp(1.35rem,3vw,1.65rem)] [&_h3]:tracking-[-0.03em]',
  '[&_p]:m-0 [&_p]:mb-4 [&_p]:text-[0.98rem] [&_p]:leading-[1.6] [&_p]:text-muted',
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
  '[&_button]:min-h-12 [&_button]:w-full [&_button]:justify-center',
  '[&_a]:min-h-12 [&_a]:w-full [&_a]:justify-center',
);

export const REDEEM_PRODUCT_PANEL_ERROR_KINDS = [
  'error',
  'invalid',
  'exhausted',
  'used',
  'closed',
  'denied',
  'conflict',
  'stale',
  'timeout',
  'auth',
] as const;

export const REDEEM_PRODUCT_OUTCOME_ERROR_KINDS = [
  'error',
  'invalid',
  'exhausted',
  'used',
  'closed',
  'denied',
  'conflict',
] as const;

const PRODUCT_PANEL_ERROR_KINDS = new Set<string>(REDEEM_PRODUCT_PANEL_ERROR_KINDS);
const PRODUCT_OUTCOME_ERROR_KINDS = new Set<string>(REDEEM_PRODUCT_OUTCOME_ERROR_KINDS);

export function redeemProductUxClass(kind: string): string {
  const base = cn(redeemOutcomePanel);
  if (kind === 'success') {
    return cn(base, redeemOutcomeSuccess);
  }
  if (PRODUCT_PANEL_ERROR_KINDS.has(kind)) {
    return cn(base, redeemOutcomeError);
  }
  return base;
}

export function redeemProductErrorOutcome(kind: string): boolean {
  return PRODUCT_OUTCOME_ERROR_KINDS.has(kind);
}
