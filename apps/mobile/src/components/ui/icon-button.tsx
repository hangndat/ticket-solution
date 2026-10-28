import { useState, type ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { space } from '@/theme/tokens';

export type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** 44×44 icon hit target — design-system Pressable for toolbar/status icons. */
export function IconButton({
  children,
  disabled,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  hitSlop = space.xs,
  style,
  testID,
  ...rest
}: IconButtonProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      hitSlop={
        typeof hitSlop === 'number'
          ? { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }
          : hitSlop
      }
      style={[
        {
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: focused ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
