import { cn } from '../../lib/utils';
import {
  authButtonsRow,
  fadeRiseMotion,
  guestFormRoot,
  introLead,
  lpPageShell,
  meResultPre,
  redeemDevStatusClass,
  redeemMetaDetails,
} from '../redeem/redeem-surface';

/** Claim / invite / route error & not-found — shared lp-* shell (Tailwind v4, D-1). */

export const guestPageMain = cn(
  lpPageShell,
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:fill-mode-both motion-reduce:animate-none',
);

export const routeShellMain = cn(
  guestPageMain,
  '[&>h1]:mb-5 [&>h1]:font-display [&>h1]:text-[clamp(2.8rem,7vw,5rem)] [&>h1]:leading-[1.05] [&>h1]:tracking-[-0.04em]',
  '[&>p]:max-w-[620px]',
);

export const eyebrowKicker =
  'text-[0.72rem] font-bold uppercase tracking-[0.12em] text-muted';

export const claimInviteHeader = cn(
  'mt-8 max-w-[40rem] text-left',
  '[&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-[clamp(1.85rem,4.5vw,2.4rem)] [&_h1]:tracking-[-0.04em]',
  'max-[480px]:[&_h1]:text-[1.75rem]',
  fadeRiseMotion,
);

export const claimInviteIntro = introLead;

export const claimFormRoot = guestFormRoot;

export const inviteSupportCopy = 'max-w-[36rem] text-muted';

export const inviteFormPanel = cn(
  'grid max-w-[36rem] gap-4 border-2 border-[color-mix(in_srgb,var(--color-ink)_8%,var(--color-paper))] bg-[color-mix(in_srgb,var(--color-paper)_94%,var(--color-ink)_6%)] p-5',
  '[&_label]:grid [&_label]:gap-2 [&_label]:text-sm [&_label]:font-bold',
  '[&_input]:min-h-11 [&_input]:border-2 [&_input]:border-[color-mix(in_srgb,var(--color-ink)_25%,transparent)] [&_input]:bg-white [&_input]:px-3.5 [&_input]:py-3 [&_input]:font-[inherit] [&_input]:font-normal [&_input]:text-ink',
);

export const inviteFieldHint = 'text-sm leading-[1.45] text-muted';

export const guestOutcomeWrap = cn('max-w-[36rem]', fadeRiseMotion);

export function claimOutcomeClass(kind: string): string {
  if (
    kind === 'error' ||
    kind === 'denied' ||
    kind === 'expired' ||
    kind === 'auth'
  ) {
    return cn(redeemDevStatusClass('error'), guestOutcomeWrap);
  }
  if (kind === 'pending') {
    return cn(redeemDevStatusClass('pending'), guestOutcomeWrap);
  }
  if (kind === 'success') {
    return cn(redeemDevStatusClass('success'), guestOutcomeWrap);
  }
  return cn(redeemDevStatusClass('unknown'), guestOutcomeWrap);
}

export function inviteSuccessOutcomeClass(): string {
  return cn(redeemDevStatusClass('success'), guestOutcomeWrap);
}

export {
  authButtonsRow,
  meResultPre,
  redeemMetaDetails,
};
