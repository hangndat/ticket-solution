import { Stack, router } from 'expo-router';
import { sameStaffGateScope } from '@/gate/staff-gate-events';
import { staffGateNavTitle } from '@/gate/staff-gate-nav-title';
import { useStaffGateWorkspace } from '@/gate/staff-gate-workspace-context';
import { STAFF_ACCOUNT_HREF } from '@/navigation/staff-account-route';
import { TabStackTitle } from '@/navigation/tab-stack-title';

type StaffGateScreenChromeProps = {
  /** Bottom tab / large-title label (Nhập tay, Scan, Lịch sử). */
  tabTitle: string;
  largeTitle?: boolean;
};

/**
 * Shared native header: nav title = event; toolbar = event menu (if >1) + account actions.
 * Place after scroll root (Expo Router composition).
 */
export function StaffGateScreenChrome({
  tabTitle,
  largeTitle = true,
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
          headerLargeTitleEnabled: largeTitle,
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="person.circle"
          accessibilityLabel="Tài khoản"
          onPress={() => {
            router.push(STAFF_ACCOUNT_HREF);
          }}
        />
        {canSwitch ? (
          <Stack.Toolbar.Menu>
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
        <Stack.Toolbar.Menu icon="ellipsis.circle">
          <Stack.Toolbar.MenuAction
            icon="arrow.clockwise"
            onPress={() => void gate.refreshGateEvents()}
          >
            Làm mới sự kiện
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    </>
  );
}
