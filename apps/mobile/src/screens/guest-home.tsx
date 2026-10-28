import { useEffect, useSyncExternalStore } from 'react';
import { ScrollView, Text } from 'react-native';
import { router, type Href } from 'expo-router';
import { useAttendeeSignIn } from '@/attendee/use-attendee-sign-in';
import { AttendeeCta } from '@/components/attendee-cta';
import { Notice } from '@/components/page';
import { eventsCopy } from '@/components/screen-state-copy';
import { session } from '@/identity/session';
import { AttendeeScreenChrome } from '@/navigation/attendee-screen-chrome';
import { STAFF_DEFAULT_SCAN_HREF } from '@/navigation/staff-default-tab-target';
import { useStaffWorkspace } from '@/navigation/use-staff-workspace';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

const GUEST_HOME_TITLE = 'Vemoki';

/**
 * Guest shell: no NativeTabs. Login + global redeem (confirm still gates auth).
 */
export function GuestHomeScreen() {
  const staffWorkspace = useStaffWorkspace();
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const { busy, error, configured, signIn } = useAttendeeSignIn();

  useEffect(() => {
    if (identity.status !== 'verified') return;
    if (staffWorkspace) {
      router.replace(STAFF_DEFAULT_SCAN_HREF as Href);
      return;
    }
    router.replace('/(tabs)/(events)' as Href);
  }, [identity.status, staffWorkspace]);

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{
          padding: space.xl,
          paddingBottom: space.huge,
          gap: space.lg,
        }}
      >
        <Text
          style={{
            ...typography.subhead,
            color: colors.secondary,
            fontFamily: fontFamilies.body,
            lineHeight: 22,
          }}
        >
          {eventsCopy.heroSupport}
        </Text>
        <AttendeeCta
          label={eventsCopy.signInCta}
          onPress={() => void signIn()}
          disabled={busy || !configured}
          testID="guest-home-signin"
        />
        <AttendeeCta
          label={eventsCopy.redeemCta}
          variant="secondary"
          onPress={() => router.push('/redeem-global')}
          testID="guest-home-redeem"
        />
        {error ? (
          <Notice title="Không đăng nhập được" tone="deny">
            {error}
          </Notice>
        ) : null}
      </ScrollView>
      <AttendeeScreenChrome title={GUEST_HOME_TITLE} />
    </>
  );
}
