import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { NativeTabs } from 'expo-router/native-tabs';
import { session } from '@/identity/session';
import { staffEligibility } from '@/identity/staff-eligibility';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabLayout() {
  const { theme } = useTheme();
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

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (session.getSnapshot().status !== 'verified') return;
      void staffEligibility.refresh(session);
    });
    return () => sub.remove();
  }, []);

  const showStaff = eligibility.staffEligible === true;

  return (
    <NativeTabs tintColor={theme.signal}>
      <NativeTabs.Trigger name="(events)">
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>Sự kiện</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-tickets">
        <NativeTabs.Trigger.Icon sf="ticket" />
        <NativeTabs.Trigger.Label>Vé của tôi</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="staff" hidden={!showStaff}>
        <NativeTabs.Trigger.Icon sf="person.badge.shield.checkmark" />
        <NativeTabs.Trigger.Label>Nhân viên</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
