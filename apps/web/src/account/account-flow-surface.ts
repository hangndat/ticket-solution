import { cn } from '../../lib/utils';
import { eyebrowKicker } from '../guest/guest-flow-surface';
import {
  authButtonsRow,
  fadeRiseMotion,
  lpPageShell,
  redeemDevFormRoot,
  redeemDevStatusClass,
} from '../redeem/redeem-surface';

/** Account + product privacy shell — Tailwind v4 + @theme tokens (D-1). */

export const accountPageMain = cn(
  lpPageShell,
  '[--brand:var(--color-signal)]',
);

export const accountPageTitle =
  'm-6 mb-0 mt-6 text-[clamp(1.75rem,4vw,2.35rem)] leading-[1.15] tracking-[-0.02em]';

export const accountPageLead =
  'm-0 mt-3 max-w-[40rem] leading-[1.55] text-ink-muted';

export const accountCols = cn(
  'mt-5 grid items-start gap-5',
  'min-[768px]:grid-cols-[minmax(200px,220px)_minmax(0,1fr)] min-[768px]:gap-10',
);

export const accountMainCol = 'min-w-0';

export const accountNav = cn(
  'grid content-start gap-1.5',
  'max-[767px]:grid-flow-col max-[767px]:auto-cols-max max-[767px]:overflow-x-auto max-[767px]:pb-2 max-[767px]:[-webkit-overflow-scrolling:touch]',
);

export const accountNavLink = cn(
  'block min-h-11 whitespace-nowrap rounded-md border border-transparent px-3.5 py-3 text-left text-[0.92rem] font-semibold text-muted no-underline',
  'hover:bg-[color-mix(in_srgb,var(--color-paper)_70%,white)] hover:text-ink',
);

export const accountNavLinkActive = cn(
  accountNavLink,
  'border-[color-mix(in_srgb,var(--color-focus)_12%,var(--color-line))] bg-[color-mix(in_srgb,var(--color-focus)_8%,var(--color-paper))] text-[color-mix(in_srgb,var(--color-focus)_55%,var(--color-ink))]',
);

export const accountSectionTitle = cn(
  'm-0 mb-3 mt-6 text-[1.05rem] font-bold tracking-[-0.01em] first:mt-0',
);

export const accountSettingsGroup = cn(
  'my-3 mb-5 overflow-hidden rounded-lg border border-line bg-white',
);

export const accountRowLink = cn(
  'flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 border-0 border-b border-line bg-transparent px-[18px] py-[17px] text-left font-[inherit] text-inherit no-underline last:border-b-0',
  'hover:bg-[color-mix(in_srgb,var(--color-paper)_65%,white)] focus-visible:outline-offset-[-2px]',
);

export const accountRowSub =
  'mt-[5px] block text-[0.88rem] font-normal leading-[1.5] text-ink-muted';

export const accountRowChevron = 'shrink-0 text-muted';

export const accountSettingsNotice = cn(
  'my-3 mb-5 rounded-lg border border-line bg-[color-mix(in_srgb,var(--color-focus)_6%,white)] px-5 py-4 text-[0.92rem] leading-[1.55] text-ink',
  '[&_p]:m-0',
);

export const accountDeletionBlock = cn(
  'mt-4',
  '[&_.account-section-heading]:mt-0',
);

export const accountSectionHeading = cn(
  'account-section-heading mt-7 text-[clamp(1.25rem,2.5vw,1.6rem)]',
);

export const accountEmbeddedSessionWrap = cn(
  accountSettingsGroup,
  '[&_section]:m-0 [&_section]:max-w-none [&_section]:animate-none [&_section]:border-0 [&_section]:p-[17px_18px]',
  '[&_section_h2]:m-0 [&_section_h2]:mb-2 [&_section_h2]:text-base [&_section_h2]:font-bold',
  '[&_.account-session-eyebrow]:hidden',
  '[&_.account-session-email]:text-[0.95rem]',
  '[&_.account-session-actions]:mt-4',
);

export const accountSessionEyebrow = cn('account-session-eyebrow', eyebrowKicker);

export const accountSessionPanel = cn(
  'account-session-panel my-6 max-w-[36rem] border-y border-ink-faint py-5',
  fadeRiseMotion,
  '[&_h2]:mb-2 [&_h2]:text-[clamp(1.35rem,2.8vw,1.85rem)]',
);

export const accountSessionEmail = 'account-session-email m-0 mb-0 text-[1.05rem] text-ink-muted';

export const accountSessionActions = cn('account-session-actions', authButtonsRow);

export const accountBackLink = 'mt-7 text-[0.92rem]';

export const accountPrivacyProse = cn(
  'max-w-[42rem]',
  '[&_h2]:m-0 [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-[1.1rem]',
  '[&_p]:m-0 [&_p]:mb-4 [&_p]:leading-[1.6] [&_p]:text-ink',
);

export const accountPrivacyUpdated =
  'text-[0.92rem] text-ink-muted';

export const accountDeletionFormRoot = redeemDevFormRoot;

export const accountDeletionNote = cn(
  'my-9 max-w-[40rem] border border-line bg-[color-mix(in_srgb,var(--color-paper)_60%,white)] p-6',
  '[&_h2]:m-0 [&_h2]:mb-2 [&_h2]:text-[1.2rem] [&_h2]:tracking-normal',
  '[&_p]:m-0',
);

export const accountDeletionCurrentPanel = cn(
  redeemDevStatusClass('success'),
  '[&_dl]:m-0 [&_dl]:grid [&_dl]:gap-2',
  '[&_dl>div]:grid [&_dl>div]:grid-cols-[auto_1fr] [&_dl>div]:gap-x-3 [&_dl>div]:gap-y-1',
  '[&_dt]:font-bold [&_dd]:m-0',
);

export const accountDeletionOutcomeOk = cn(
  redeemDevStatusClass('success'),
  fadeRiseMotion,
  '[&_p]:m-0',
);

export const accountDeletionOutcomeError = cn(
  redeemDevStatusClass('error'),
  fadeRiseMotion,
  '[&_p]:m-0',
);
