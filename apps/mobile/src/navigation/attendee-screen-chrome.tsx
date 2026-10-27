import { useSyncExternalStore } from 'react';
import { Stack, router } from 'expo-router';
import { accountCopy } from '@/components/screen-state-copy';
import { session } from '@/identity/session';
import { ATTENDEE_ACCOUNT_HREF } from '@/navigation/attendee-account-route';
import { TabStackTitle } from '@/navigation/tab-stack-title';

type AttendeeScreenChromeProps = {
  title: string;
  large?: boolean;
};

/**
 * Native tab-root / guest-home chrome: large title + account toolbar (staff pattern).
 * Place after the scroll root.
 */
export function AttendeeScreenChrome({
  title,
  large = true,
}: AttendeeScreenChromeProps) {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const signedIn = identity.status === 'verified';

  return (
    <>
      <TabStackTitle title={title} large={large} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="person.circle"
          accessibilityLabel={
            signedIn ? accountCopy.screenTitle : accountCopy.guest.signInCta
          }
          onPress={() => {
            router.push(ATTENDEE_ACCOUNT_HREF);
          }}
        />
      </Stack.Toolbar>
    </>
  );
}
