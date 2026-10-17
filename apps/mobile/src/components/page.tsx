import type { PropsWithChildren } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { brand, colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export function Page({ children }: PropsWithChildren) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
    >
      {children}
    </ScrollView>
  );
}

/** Platform wordmark — brand-first chrome (`vemoki↗`). */
export function BrandWordmark({ compact = false }: { compact?: boolean } = {}) {
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel={`${brand.wordmark}${brand.signalMark}`}
      style={{
        ...(compact ? typography.callout : typography.wordmark),
        color: brand.ink,
      }}
    >
      {brand.wordmark}
      <Text style={{ color: brand.signal }}>{brand.signalMark}</Text>
    </Text>
  );
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
