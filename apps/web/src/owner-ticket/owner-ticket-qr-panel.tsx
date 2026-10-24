'use client';

import { useEffect, useState } from 'react';
import { ATTENDEE_COPY } from '../attendee-copy';
import {
  attendeeTicketOfflineBanner,
  attendeeTicketQrCaption,
  attendeeTicketQrPanel,
} from '../attendee-detail-surface';
import { TicketQr } from './ticket-qr';

type Props = {
  tenantId: string;
  ticketId: string;
  state: string;
  qrPayload: string;
  qrLabel: string;
};

/** Client-only; safe to call from effects after mount. */
export function readBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

function subscribeOnline(setOffline: (offline: boolean) => void): () => void {
  const update = () => setOffline(readBrowserOffline());
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}

export function OwnerTicketQrPanel({
  qrPayload,
  qrLabel,
}: Props) {
  const [offline, setOffline] = useState(false);

  useEffect(() => subscribeOnline(setOffline), []);

  return (
    <>
      {offline ? (
        <p
          className={attendeeTicketOfflineBanner}
          role="status"
          data-testid="owner-ticket-offline-label"
        >
          {ATTENDEE_COPY.offlineQrBanner}
        </p>
      ) : null}
      <figure className={attendeeTicketQrPanel} data-testid="owner-ticket-qr-figure">
        <TicketQr value={qrPayload} label={qrLabel} />
        <figcaption className={attendeeTicketQrCaption}>{qrLabel}</figcaption>
      </figure>
    </>
  );
}
