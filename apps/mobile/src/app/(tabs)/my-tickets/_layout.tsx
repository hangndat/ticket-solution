import { Stack } from 'expo-router/stack';
export default function Layout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: 'My Tickets' }} />
      <Stack.Screen name="[ticketId]" options={{ title: 'Ticket', headerLargeTitle: false }} />
    </Stack>
  );
}
