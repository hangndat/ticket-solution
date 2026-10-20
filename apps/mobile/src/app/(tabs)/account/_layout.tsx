import { Stack } from 'expo-router';
import { tabAttendeeCompactStackScreenOptions } from '@/navigation/tab-stack-options';

export default function AccountTabLayout() {
  return (
    <Stack screenOptions={tabAttendeeCompactStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Tài khoản' }} />
      <Stack.Screen
        name="delete"
        options={{ title: 'Xóa tài khoản', headerLargeTitleEnabled: false }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          title: 'Chính sách quyền riêng tư',
          headerLargeTitleEnabled: false,
        }}
      />
    </Stack>
  );
}
