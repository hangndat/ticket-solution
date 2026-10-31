import { Stack } from 'expo-router';
import { tabDetailStackScreenOptions } from '@/navigation/tab-stack-options';

/** Root stack (outside NativeTabs) — guest + verified attendee account. */
export default function AttendeeAccountRootLayout() {
  return (
    <Stack screenOptions={tabDetailStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Tài khoản' }} />
      <Stack.Screen name="delete" options={{ title: 'Xóa tài khoản' }} />
    </Stack>
  );
}
