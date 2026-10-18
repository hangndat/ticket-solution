import type { PropsWithChildren } from 'react';
import { useFonts } from 'expo-font';
import { Text, View } from 'react-native';
import { brand } from './tokens.ts';
import { fontFamilies } from './fonts.ts';

/**
 * Load self-hosted Sora / Be Vietnam Pro once at root.
 * On failure, children still render (system fallback) — never block wallet.
 */
export function BrandFontsGate({ children }: PropsWithChildren) {
  const [loaded, error] = useFonts({
    [fontFamilies.display]: require('../../assets/fonts/Sora-Variable.ttf'),
    [fontFamilies.body]: require('../../assets/fonts/BeVietnamPro-Regular.ttf'),
    [fontFamilies.bodyMedium]: require('../../assets/fonts/BeVietnamPro-Medium.ttf'),
    [fontFamilies.bodySemiBold]: require('../../assets/fonts/BeVietnamPro-SemiBold.ttf'),
    [fontFamilies.bodyBold]: require('../../assets/fonts/BeVietnamPro-Bold.ttf'),
  });

  if (!loaded && !error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: brand.paper,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: brand.ink, fontSize: 17 }}>Đang tải…</Text>
      </View>
    );
  }

  return <>{children}</>;
}
