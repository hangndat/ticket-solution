import { Stack } from 'expo-router';
import { tabDetailStackScreenOptions } from '@/navigation/tab-stack-options';

/** Root stack (outside NativeTabs) — iOS cannot navigate hidden tab triggers. */
export default function StaffAccountRootLayout() {
  return (
    <Stack screenOptions={tabDetailStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Tài khoản' }} />
      <Stack.Screen name="delete" options={{ title: 'Xóa tài khoản' }} />
      <Stack.Screen
        name="privacy"
        options={{ title: 'Chính sách quyền riêng tư' }}
      />
    </Stack>
  );
}
