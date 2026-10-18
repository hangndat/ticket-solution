import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Notice, Page } from '@/components/page';
import { LoadingState } from '@/components/screen-state';
import { session } from '@/identity/session';
import {
  staffDenyCopy,
  staffEligibility,
} from '@/identity/staff-eligibility';
import { colors } from '@/theme/colors';

/**
 * Deep-link / soft-entry for staff when tab may be hidden (O02).
 * Eligible → replace into tab staff. Otherwise VI fail-closed deny (no empty shell).
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

  return (
    <Page>
      <Notice title={staffDenyCopy.title} tone="deny">
        {staffDenyCopy.body}
      </Notice>
      <Text
        accessibilityLiveRegion="assertive"
        accessibilityRole="text"
        style={{ color: colors.secondary, fontSize: 15, lineHeight: 22 }}
      >
        {staffDenyCopy.announcement}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Về trang Sự kiện"
        onPress={() => {
          router.replace('/(tabs)/(events)');
        }}
        style={{
          marginTop: 8,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: colors.signal,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.onAccent, fontSize: 17, fontWeight: '600' }}>
          Về Sự kiện
        </Text>
      </Pressable>
    </Page>
  );
}
