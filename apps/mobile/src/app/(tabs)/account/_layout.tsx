import { Stack } from 'expo-router';
import { accountCopy } from '@/components/screen-state-copy';
import {
  tabDetailStackScreenOptions,
  tabRootStackScreenOptions,
} from '@/navigation/tab-stack-options';

export default function AccountTabLayout() {
  return (
    <Stack screenOptions={tabRootStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: accountCopy.screenTitle }} />
      <Stack.Screen
        name="delete"
        options={{
          ...tabDetailStackScreenOptions,
          title: 'Xóa tài khoản',
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          ...tabDetailStackScreenOptions,
          title: 'Chính sách quyền riêng tư',
        }}
      />
    </Stack>
  );
}
