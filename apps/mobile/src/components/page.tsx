import type { PropsWithChildren } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AtmosphereWash } from '@/components/screen-atmosphere';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { TenantLogo } from '@/theme/TenantLogo';

export function Page({ children }: PropsWithChildren) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <AtmosphereWash />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * Platform wordmark / tenant logo — brand-first chrome.
 * Uses ThemeProvider when present; logo URL falls back to text wordmark.
 */
export function BrandWordmark({ compact = false }: { compact?: boolean } = {}) {
  return <TenantLogo compact={compact} />;
}

export function Notice({
  title,
  children,
  tone = 'default',
}: PropsWithChildren<{
  title: string;
  tone?: 'default' | 'admit' | 'deny' | 'unknown';
}>) {
  const accent =
    tone === 'admit'
      ? colors.admit
      : tone === 'deny'
        ? colors.deny
        : tone === 'unknown'
          ? colors.unknown
          : undefined;

  return (
    <View
      style={{
        padding: 20,
        gap: 12,
        backgroundColor: colors.card,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderLeftWidth: accent ? 4 : 0,
        borderLeftColor: accent,
      }}
    >
      <Text
        selectable
        style={{
          color: colors.label,
          fontSize: 22,
          fontFamily: fontFamilies.display,
          fontWeight: '600',
        }}
      >
        {title}
      </Text>
      {children != null && children !== '' ? (
        <Text
          selectable
          style={{
            color: colors.secondary,
            fontSize: 17,
            lineHeight: 25,
            fontFamily: fontFamilies.body,
          }}
        >
          {children}
        </Text>
      ) : null}
    </View>
  );
}
