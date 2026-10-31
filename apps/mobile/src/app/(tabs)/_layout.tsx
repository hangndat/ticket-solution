import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { NativeTabs } from 'expo-router/native-tabs';
import { StaffGateWorkspaceProvider } from '@/gate/staff-gate-workspace-context';
import { session } from '@/identity/session';
import { staffEligibility } from '@/identity/staff-eligibility';
import { tryRestoreVerifiedSession } from '@/identity/session-restore-retry';
import { ATTENDEE_TAB_TITLES } from '@/navigation/attendee-tab-titles';
import { StaffDefaultTabRedirect } from '@/navigation/staff-default-tab-redirect';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';
import {
  useShowAttendeeTabs,
  useStaffWorkspace
} from '@/navigation/use-staff-workspace';
import { useMyTicketsTabChrome } from '@/navigation/use-wallet-access';
import { useTheme } from '@/theme/ThemeProvider';
import { brand } from '@/theme/tokens';

export default function TabLayout() {
  const { theme } = useTheme();
  const staffWorkspace = useStaffWorkspace();
  const showAttendee = useShowAttendeeTabs();
  const { visible: myTicketsTab } = useMyTicketsTabChrome();
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
      void (async () => {
        await tryRestoreVerifiedSession(session);
        if (session.getSnapshot().status === 'verified') {
          void staffEligibility.refresh(session);
        }
      })();
    });
    return () => sub.remove();
  }, []);

  const showStaffTabs =
    staffWorkspace ||
    (eligibility.resolved && eligibility.staffEligible === true);
  const showEventsTab = showAttendee;
  const showRedeemTab = showAttendee;

  return (
    <StaffGateWorkspaceProvider active={identity.status === 'verified'}>
      <StaffDefaultTabRedirect />
      <NativeTabs tintColor={theme.source === 'default' ? brand.primary : theme.signal}>
        <NativeTabs.Trigger name="(events)" hidden={!showEventsTab}>
          <NativeTabs.Trigger.Icon sf="calendar" />
          <NativeTabs.Trigger.Label>
            {ATTENDEE_TAB_TITLES.events}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="redeem" hidden={!showRedeemTab}>
          <NativeTabs.Trigger.Icon sf="text.badge.plus" />
          <NativeTabs.Trigger.Label>
            {ATTENDEE_TAB_TITLES.redeem}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="my-tickets" hidden={!myTicketsTab}>
          <NativeTabs.Trigger.Icon sf="ticket" />
          <NativeTabs.Trigger.Label>
            {ATTENDEE_TAB_TITLES.tickets}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="staff-manual" hidden={!showStaffTabs}>
          <NativeTabs.Trigger.Icon sf="keyboard" />
          <NativeTabs.Trigger.Label>{STAFF_TAB_TITLES.manual}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="staff-scan" hidden={!showStaffTabs}>
          <NativeTabs.Trigger.Icon sf="qrcode.viewfinder" />
          <NativeTabs.Trigger.Label>{STAFF_TAB_TITLES.scan}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="staff-history" hidden={!showStaffTabs}>
          <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" />
          <NativeTabs.Trigger.Label>{STAFF_TAB_TITLES.history}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="account" hidden>
          <NativeTabs.Trigger.Icon sf="person.circle" />
          <NativeTabs.Trigger.Label>Tài khoản</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </StaffGateWorkspaceProvider>
  );
}
