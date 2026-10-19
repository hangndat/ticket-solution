import { Stack } from 'expo-router';
import { AccountScreen } from '@/screens/account';
import { tabDetailStackScreenOptions } from '@/navigation/tab-stack-options';

/** Account outside tabs — staff toolbar + deep links; OIDC only here. */
export default function AccountRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          ...tabDetailStackScreenOptions,
          title: 'Tài khoản',
        }}
      />
      <AccountScreen presentation="stack" />
    </>
  );
}
