import { useEffect } from 'react';
import { Stack } from 'expo-router/stack';
import { isOidcConfigured } from '@/identity/config';
import { session } from '@/identity/session';

function AppStack() {
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

export default function RootLayout() {
  const configured = isOidcConfigured();

  useEffect(() => {
    if (configured) return;
    // Fail closed: no OIDC → clear any leftover Keychain credential.
    void session.restore().catch(() => {
      /* Remain unknown on storage failure; never infer verified identity. */
    });
  }, [configured]);

  return <AppStack />;
}
