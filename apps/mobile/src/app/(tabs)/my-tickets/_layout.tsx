import { Stack } from 'expo-router/stack';
export default function Layout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: 'Vé của tôi' }} />
      <Stack.Screen
        name="[ticketId]"
        options={{ title: 'Vé của bạn', headerLargeTitle: false }}
      />
    </Stack>
  );
}
