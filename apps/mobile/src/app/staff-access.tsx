import { useEffect, useSyncExternalStore } from 'react';
import { Animated, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { AttendeeCta } from '@/components/attendee-cta';
import { Notice, Page } from '@/components/page';
import { LoadingState } from '@/components/screen-state';
import { useFadeInOnMount } from '@/hooks/use-fade-in-on-mount';
import { session } from '@/identity/session';
import {
  staffDenyCopy,
  staffEligibility,
} from '@/identity/staff-eligibility';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';

/**
 * Deep-link / soft-entry for staff when tab may be hidden (O02).
 * Eligible → replace into tab staff. Otherwise VI fail-closed deny (no scanner preview).
 */
export default function StaffAccessScreen() {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const eligibility = useSyncExternalStore(
    staffEligibility.subscribe,
    staffEligibility.getSnapshot,
    staffEligibility.getSnapshot,
  );

  useEffect(() => {
    if (identity.status !== 'verified') {
      staffEligibility.reset();
      return;
    }
    void staffEligibility.refresh(session);
  }, [identity]);

  if (identity.status === 'verified' && (!eligibility.resolved || eligibility.loading)) {
    return (
      <Page>
        <LoadingState title="Đang kiểm tra quyền nhân viên">
          Chưa mở khu vực Nhân viên cho đến khi máy chủ xác nhận.
        </LoadingState>
      </Page>
    );
  }

  if (eligibility.staffEligible) {
    return <Redirect href="/(tabs)/staff" />;
  }

  return <StaffAccessDeny />;
}

function StaffAccessDeny() {
  const { opacity, reduceMotionOs } = useFadeInOnMount(true);

  return (
    <Page>
      <Animated.View
        style={{ gap: 20, opacity: reduceMotionOs ? 1 : opacity }}
        accessibilityLiveRegion="assertive"
      >
        <Notice title={staffDenyCopy.title} tone="deny">
          {staffDenyCopy.body}
        </Notice>
        <Text
          accessibilityRole="text"
          style={{
            color: colors.secondary,
            fontSize: 15,
            lineHeight: 22,
            fontFamily: fontFamilies.body,
          }}
        >
          {staffDenyCopy.announcement}
        </Text>
        <View>
          <AttendeeCta
            label="Về Sự kiện"
            accessibilityLabel="Về trang Sự kiện"
            onPress={() => router.replace('/(tabs)/(events)')}
            testID="staff-access-cta-events"
          />
        </View>
      </Animated.View>
    </Page>
  );
}
