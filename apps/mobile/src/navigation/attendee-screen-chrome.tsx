import { useSyncExternalStore } from 'react';
import { Stack, router, type Href } from 'expo-router';
import { useAttendeeSignIn } from '@/attendee/use-attendee-sign-in';
import { accountCopy } from '@/components/screen-state-copy';
import { session } from '@/identity/session';
import { ATTENDEE_ACCOUNT_HREF } from '@/navigation/attendee-account-route';
import { TabStackTitle } from '@/navigation/tab-stack-title';

type AttendeeScreenChromeProps = {
  title: string;
  large?: boolean;
};

/**
 * Native tab-root chrome: large title + header identity (staff pattern).
 * Guest: OIDC sign-in on the current screen. Verified: push unique root
 * `/attendee-account` (not the hidden NativeTabs `account` trigger).
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
  const { signIn } = useAttendeeSignIn();

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
            if (signedIn) {
              router.push(ATTENDEE_ACCOUNT_HREF as Href);
              return;
            }
            void signIn();
          }}
        />
      </Stack.Toolbar>
    </>
  );
}
