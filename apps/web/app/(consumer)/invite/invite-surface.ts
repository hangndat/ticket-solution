import { cn } from "../../../lib/utils";
import { guestPageMain } from "../../../src/guest/guest-flow-surface";

/** Invite-only compact layout; other guest flows keep their shared chrome. */
export const invitePageMain = cn(
  guestPageMain,
  "max-w-[40rem] max-[480px]:min-h-0 max-[480px]:p-4",
  "[&:has([data-invite-success])>header]:hidden",
  "max-[480px]:[&>header]:mt-0 max-[480px]:[&>header_h1]:text-2xl max-[480px]:[&>header_h1]:leading-tight max-[480px]:[&>header_h1]:mb-2",
  "max-[480px]:[&>header_p]:text-sm max-[480px]:[&>header_p]:leading-normal max-[480px]:[&>header_p]:my-0",
);

export const inviteCompactForm =
  "min-w-0 gap-4 my-4 [&>p]:m-0 [&>div]:min-w-0 max-[480px]:text-sm max-[480px]:leading-normal max-[480px]:[&>div:has(>a)]:my-0 max-[480px]:[&_a]:w-full max-[480px]:[&_a]:justify-center max-[480px]:[&_a]:whitespace-normal [&_[data-invite-success]]:my-0 [&_[data-invite-success]]:scroll-mt-20 max-[480px]:[&_[data-invite-success]]:p-4 max-[480px]:[&_[data-invite-success]]:rounded-xl max-[480px]:[&_[data-invite-success]_h2]:text-2xl max-[480px]:[&_[data-invite-success]_h2]:leading-snug";

// 16px avoids iOS focus auto-zoom while preserving user pinch zoom.
export const inviteCompactPanel =
  "w-full min-w-0 [&_input]:w-full [&_input]:min-w-0 [&_input]:text-base max-[480px]:p-4 max-[480px]:gap-3 max-[480px]:rounded-xl max-[480px]:[&_button]:w-full max-[480px]:[&_button]:whitespace-normal";
