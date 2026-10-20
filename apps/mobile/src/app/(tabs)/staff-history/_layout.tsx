import { Stack } from 'expo-router';
import { tabRootStackScreenOptions } from '@/navigation/tab-stack-options';
import { STAFF_TAB_TITLES } from '@/navigation/staff-tab-titles';

export default function StaffHistoryTabLayout() {
  return (
    <Stack screenOptions={tabRootStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: STAFF_TAB_TITLES.history }} />
    </Stack>
  );
}
