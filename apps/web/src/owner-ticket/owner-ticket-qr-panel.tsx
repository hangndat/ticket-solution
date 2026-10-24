'use client';

import { useEffect, useState } from 'react';
import { ATTENDEE_COPY } from '../attendee-copy';
import {
  attendeeTicketOfflineBanner,
  attendeeTicketQrCaption,
  attendeeTicketQrPanel,
} from '../attendee-detail-surface';
import { writeOwnerTicketDisplayCache } from './display-cache';
import { TicketQr } from './ticket-qr';

type Props = {
  tenantId: string;
  ticketId: string;
  state: string;
  qrPayload: string;
  qrLabel: string;
};

function subscribeOnline(setOffline: (offline: boolean) => void): () => void {
  const update = () => setOffline(typeof navigator !== 'undefined' && !navigator.onLine);
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}

export function OwnerTicketQrPanel({
  tenantId,
  ticketId,
  state,
  qrPayload,
  qrLabel,
}: Props) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    writeOwnerTicketDisplayCache({
      tenantId,
      ticketId,
      qrPayload,
      state,
      cachedAt: new Date().toISOString(),
    });
    return subscribeOnline(setOffline);
  }, [tenantId, ticketId, qrPayload, state]);

  return (
    <>
      {offline ? (
        <p
          className={attendeeTicketOfflineBanner}
          role="status"
          data-testid="owner-ticket-offline-label"
        >
          {ATTENDEE_COPY.offlineCachedQr}
        </p>
      ) : null}
      <figure className={attendeeTicketQrPanel} data-testid="owner-ticket-qr-figure">
        <TicketQr value={qrPayload} label={qrLabel} />
        <figcaption className={attendeeTicketQrCaption}>{qrLabel}</figcaption>
      </figure>
    </>
  );
}
