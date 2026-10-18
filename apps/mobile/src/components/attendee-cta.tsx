import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** signal fill (primary) vs paper/ink outline secondary */
  variant?: 'primary' | 'secondary';
  accessibilityLabel?: string;
  testID?: string;
};

/** Shared attendee CTA — Live Pulse signal fill, ≥44pt hit, focus ring. */
export function AttendeeCta({
  label,
  onPress,
  disabled,
  variant = 'primary',
  accessibilityLabel,
  testID,
}: Props) {
  const [focused, setFocused] = useState(false);
  const primary = variant === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: primary ? colors.accent : colors.card,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        borderWidth: focused ? 2 : primary ? 0 : 1,
        borderColor: focused ? colors.focus : colors.ink,
      })}
    >
      <Text
        style={{
          color: primary ? colors.onAccent : colors.ink,
          fontSize: 17,
          fontFamily: fontFamilies.bodySemiBold,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
