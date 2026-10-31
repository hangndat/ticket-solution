import { useState, type ReactNode } from 'react';
import {
  Pressable,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '@/theme/colors';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

export type ChipProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** Selectable chip — design-system Pressable for radio/filter rows. */
export function Chip({
  label,
  selected = false,
  disabled,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  style,
  testID,
  children,
  ...rest
}: ChipProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled: Boolean(disabled), ...accessibilityState }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          minHeight: 44,
          paddingHorizontal: space.lg,
          justifyContent: 'center',
          borderRadius: radius.md,
          borderWidth: focused ? 2 : 1,
          borderColor: focused
            ? colors.focus
            : selected
              ? colors.accent
              : colors.line,
          backgroundColor: selected ? colors.accent : colors.surfaceMuted,
        },
        style,
      ]}
      {...rest}
    >
      {children ?? (
        <Text
          numberOfLines={1}
          style={{
            ...typography.subheadSemibold,
            color: selected ? colors.onAccent : colors.label,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
