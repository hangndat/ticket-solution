import { Stack } from 'expo-router/stack';
import { eventsCopy } from '@/components/screen-state-copy';
import { tabRootStackScreenOptions } from '@/navigation/tab-stack-options';

/** Same native large-title chrome as staff History / Manual. */
export default function Layout() {
  return (
    <Stack screenOptions={tabRootStackScreenOptions}>
      <Stack.Screen
        name="index"
        options={{ title: eventsCopy.listHeadline }}
      />
    </Stack>
  );
}
