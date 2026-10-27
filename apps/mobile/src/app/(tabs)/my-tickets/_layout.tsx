import { Stack } from 'expo-router/stack';
import {
  tabDetailStackScreenOptions,
  tabRootStackScreenOptions,
} from '@/navigation/tab-stack-options';

export default function Layout() {
  return (
    <Stack screenOptions={tabRootStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Vé của tôi' }} />
      <Stack.Screen
        name="[ticketId]"
        options={{
          ...tabDetailStackScreenOptions,
          title: 'Vé của tôi',
        }}
      />
    </Stack>
  );
}
