import type { PropsWithChildren } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { TenantLogo } from '@/theme/TenantLogo';

export function Page({ children }: PropsWithChildren) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
    >
      {children}
    </ScrollView>
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
        style={{ color: colors.label, fontSize: 22, fontWeight: '600' }}
      >
        {title}
      </Text>
      {children != null && children !== '' ? (
        <Text
          selectable
          style={{ color: colors.secondary, fontSize: 17, lineHeight: 25 }}
        >
          {children}
        </Text>
      ) : null}
    </View>
  );
}
