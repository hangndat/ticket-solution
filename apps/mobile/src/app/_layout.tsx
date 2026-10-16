import { useEffect } from 'react';
import { Stack } from 'expo-router/stack';
import { session } from '@/identity/session';
export default function RootLayout() {
  useEffect(() => {
    void session.restore().catch(() => {
      /* Remain unknown; never infer identity on storage failure. */
    });
  }, []);
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="events/[tenantSlug]/[slug]"
        options={{ title: 'Event details' }}
      />
    </Stack>
  );
}
