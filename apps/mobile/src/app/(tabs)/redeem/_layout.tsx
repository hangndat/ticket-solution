import { Stack } from 'expo-router/stack';
import { redeemCopy } from '@/components/screen-state-copy';
import { tabRootStackScreenOptions } from '@/navigation/tab-stack-options';

/** Same native large-title chrome as staff History / attendee Events. */
export default function Layout() {
  return (
    <Stack screenOptions={tabRootStackScreenOptions}>
      <Stack.Screen
        name="index"
        options={{ title: redeemCopy.screenTitle }}
      />
    </Stack>
  );
}
