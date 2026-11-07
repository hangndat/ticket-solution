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
}>;

/** Attendee empty and unavailable states with a clear native visual hierarchy. */
export function AttendeeStateCard({
  symbol,
  title,
  tone = 'neutral',
  testID,
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
        gap: space.md,
        padding: space.xl,
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
          width: 52,
          height: 52,
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
        <SymbolView name={symbol} size={26} tintColor={tintColor} />
      </View>
      <Text
        accessibilityRole="header"
        style={{ ...typography.sectionTitleBold, color: colors.label, textAlign: 'center' }}
      >
        {title}
      </Text>
      {children != null && children !== '' ? (
        <Text style={{ ...typography.body, color: colors.secondary, textAlign: 'center' }}>
          {children}
        </Text>
      ) : null}
    </View>
  );
}
