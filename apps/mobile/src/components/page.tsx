import type { PropsWithChildren } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AtmosphereWash } from '@/components/screen-atmosphere';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { TenantLogo } from '@/theme/TenantLogo';
import { space, radius } from '@/theme/tokens';
import { typography } from '@/theme/typography';

export function Page({ children }: PropsWithChildren) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <AtmosphereWash />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.huge, gap: space.xl }}
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
  tone = 'default'
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
        padding: space.xl,
        gap: space.md,
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        borderLeftWidth: accent ? 4 : 0,
        borderLeftColor: accent
      }}
    >
      <Text
        selectable
        style={{ ...typography.title, color: colors.label,
          fontFamily: fontFamilies.display }}
      >
        {title}
      </Text>
      {children != null && children !== '' ? (
        <Text
          selectable
          style={{ ...typography.body, color: colors.secondary,
            lineHeight: 25,
            fontFamily: fontFamilies.body }}
        >
          {children}
        </Text>
      ) : null}
    </View>
  );
}
