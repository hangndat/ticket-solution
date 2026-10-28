'use client';

import { cn } from '../../lib/utils';
import type { GateLinkState } from '../../src/gate/connectivity';
import { bannerCopyForLink } from '../../src/gate/offline-messages';
import {
  attendeeNotice,
  attendeeNoticeError,
} from '../../src/attendee-surface';

type Props = {
  link: GateLinkState;
};

/**
 * Staff-facing offline / degraded banner (VI). Hidden when online.
 */
export function GateOfflineBanner({ link }: Props) {
  const copy = bannerCopyForLink(link);
  if (!copy) return null;

  return (
    <aside
      role="alert"
      data-testid="gate-offline-banner"
      data-link={link}
      className={
        link === 'offline'
          ? attendeeNoticeError
          : cn(
              attendeeNotice,
              'border-[color-mix(in_srgb,var(--color-focus)_50%,var(--color-ink))] bg-[color-mix(in_srgb,var(--color-focus)_12%,var(--color-paper))] text-ink',
            )
      }
    >
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
    </aside>
  );
}
