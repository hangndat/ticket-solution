import { Stack } from 'expo-router';
import { tabDetailStackScreenOptions } from '@/navigation/tab-stack-options';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';

/** Compact nav title aligned with bottom tab label. */
export default function StaffScanTabLayout() {
  return (
    <Stack
      screenOptions={{
        ...tabDetailStackScreenOptions,
        animation: 'none',
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: STAFF_TAB_TITLES.scan, headerShown: true }}
      />
    </Stack>
  );
}
