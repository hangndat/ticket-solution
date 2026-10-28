import { Stack, router } from 'expo-router';
import { sameStaffGateScope } from '@/gate/staff-gate-events';
import { staffGateNavTitle } from '@/gate/staff-gate-nav-title';
import { useStaffGateWorkspace } from '@/gate/staff-gate-workspace-context';
import { ATTENDEE_PROFILE_ICON_SIGNED_IN } from '@/navigation/attendee-profile-header';
import { STAFF_ACCOUNT_HREF } from '@/navigation/staff-account-route';
import { TabStackTitle } from '@/navigation/tab-stack-title';

type StaffGateScreenChromeProps = {
  /** Bottom tab / large-title label (Nhập tay, Scan, Lịch sử). */
  tabTitle: string;
  largeTitle?: boolean;
};

/**
 * Shared native header: large title + event switch (if >1) + filled profile.
 * Place after scroll root (Expo Router composition).
 */
export function StaffGateScreenChrome({
  tabTitle,
  largeTitle = true
}: StaffGateScreenChromeProps) {
  const gate = useStaffGateWorkspace();
  const canSwitch = gate.gateEventChoices.length > 1;
  const navTitle = staffGateNavTitle(gate);

  return (
    <>
      <TabStackTitle title={tabTitle} large={largeTitle} />
      <Stack.Screen
        options={{
          title: navTitle,
          headerLargeTitleEnabled: largeTitle
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={ATTENDEE_PROFILE_ICON_SIGNED_IN}
          accessibilityLabel="Tài khoản"
          onPress={() => {
            router.push(STAFF_ACCOUNT_HREF);
          }}
        />
        {canSwitch ? (
          <Stack.Toolbar.Menu
            icon="arrow.triangle.2.circlepath"
            accessibilityLabel="Đổi sự kiện"
          >
            <Stack.Toolbar.Menu inline title="Sự kiện">
              {gate.gateEventChoices.map((choice) => {
                const active =
                  gate.gateScope !== null &&
                  sameStaffGateScope(gate.gateScope, choice);
                return (
                  <Stack.Toolbar.MenuAction
                    key={`${choice.tenantId}:${choice.eventId}`}
                    isOn={active}
                    onPress={() => gate.selectGateScope(choice)}
                  >
                    {choice.name}
                  </Stack.Toolbar.MenuAction>
                );
              })}
            </Stack.Toolbar.Menu>
          </Stack.Toolbar.Menu>
        ) : null}
      </Stack.Toolbar>
    </>
  );
}
