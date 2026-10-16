import { useEffect } from 'react';
import { Stack } from 'expo-router/stack';
import { isOidcConfigured } from '@/identity/config';
import { verifyViaMe } from '@/identity/fetch-me';
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
    if (!configured) {
      // Fail closed: no OIDC → clear any leftover Keychain credential.
      void session.restore().catch(() => {
        /* Remain unknown on storage failure; never infer verified identity. */
      });
      return;
    }
    // Restore SecureStore bearer only after GET /v1/me succeeds.
    void session.restore(verifyViaMe).catch(() => {
      /* Remain unknown on storage/network failure; never stub verified. */
    });
  }, [configured]);

  return <AppStack />;
}
