import { Stack } from 'expo-router';
import { goBackOrReplace } from '@/navigation/back-or-replace';

/**
 * Account roots own a nested Stack whose first screen has no previous screen
 * inside THAT stack, so native never draws a back chevron. Explicit plain
 * chevron (same look as `headerBackButtonDisplayMode: 'minimal'`).
 */
export function AccountBackToolbar({ fallbackHref }: { fallbackHref: string }) {
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button
        icon="chevron.backward"
        accessibilityLabel="Quay lại"
        onPress={() => goBackOrReplace(fallbackHref)}
      />
    </Stack.Toolbar>
  );
}
