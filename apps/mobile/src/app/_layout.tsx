import { useEffect } from 'react';
import { Stack } from 'expo-router/stack';
import { ClerkProvider } from '@clerk/expo';
import { clerkTokenCache } from '@/identity/clerk-token-cache';
import { getClerkPublishableKey } from '@/identity/config';
import { session } from '@/identity/session';
import { SessionBridge } from '@/identity/session-bridge';

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
  const publishableKey = getClerkPublishableKey();

  useEffect(() => {
    if (publishableKey) return;
    // Fail closed: no provider verifier → clear any leftover Keychain credential.
    void session.restore().catch(() => {
      /* Remain unknown on storage failure; never infer verified identity. */
    });
  }, [publishableKey]);

  if (!publishableKey) {
    return <AppStack />;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={clerkTokenCache}>
      <SessionBridge />
      <AppStack />
    </ClerkProvider>
  );
}
