import { useSyncExternalStore } from 'react';
import { Page, Notice } from '@/components/page';
import { session } from '@/identity/session';
export function MyTicketsScreen() {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return (
    <Page>
      {identity.status === 'unknown' ? (
        <Notice title="Identity unavailable">
          We have not established a verified session. No personal tickets are
          loaded.
        </Notice>
      ) : (
        <Notice title="Your tickets will live here">
          Sign-in is not available in this foundation build. When a verified
          account is connected, its tickets will appear here.
        </Notice>
      )}
      <Notice title="No tickets on this device">
        Demo events do not issue tickets. There are no QR codes or offline
        admission credentials in this build.
      </Notice>
    </Page>
  );
}
