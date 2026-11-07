import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { colors } from '@/theme/colors';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

type AttendeeStateCardProps = PropsWithChildren<{
  symbol: SFSymbol;
  title: string;
  tone?: 'neutral' | 'warning' | 'error';
  testID?: string;
  compact?: boolean;
}>;

/** Attendee empty and unavailable states with a clear native visual hierarchy. */
export function AttendeeStateCard({
  symbol,
  title,
  tone = 'neutral',
  testID,
  compact = false,
  children,
}: AttendeeStateCardProps) {
  const tintColor =
    tone === 'error'
      ? colors.destructive
      : tone === 'warning'
        ? colors.unknown
        : colors.accent;

  return (
    <View
      testID={testID}
      style={{
        alignItems: 'center',
        gap: compact ? space.sm : space.md,
        padding: compact ? space.md : space.xl,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.onAccent,
      }}
    >
      <View
        accessible={false}
        style={{
          width: compact ? 36 : 52,
          height: compact ? 36 : 52,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.lg,
          backgroundColor:
            tone === 'error'
              ? colors.denySurface
              : tone === 'warning'
                ? colors.unknownSurface
                : colors.surfaceSubtle,
        }}
      >
        <SymbolView name={symbol} size={compact ? 20 : 26} tintColor={tintColor} />
      </View>
      <Text
        accessibilityRole="header"
        style={{ ...typography.sectionTitleBold, color: colors.label, textAlign: 'center' }}
      >
        {title}
      </Text>
      {children != null && children !== '' ? (
        <Text style={{ ...(compact ? typography.subhead : typography.body), color: colors.secondary, textAlign: 'center' }}>
          {children}
        </Text>
      ) : null}
    </View>
  );
}
