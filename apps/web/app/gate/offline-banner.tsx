'use client';

import type { GateLinkState } from '../../src/gate/connectivity';
import { bannerCopyForLink } from '../../src/gate/offline-messages';

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
          ? 'notice gate-offline-banner gate-offline-banner--offline state-error'
          : 'notice gate-offline-banner gate-offline-banner--degraded state-unknown'
      }
    >
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
    </aside>
  );
}
