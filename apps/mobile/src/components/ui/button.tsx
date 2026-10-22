import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from 'react-native';
import { Spinner } from '@/components/ui/spinner';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'md' | 'lg';

const MIN_TOUCH = 44;

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label?: string;
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  onPress,
  accessibilityLabel,
  accessibilityState,
  style,
  contentStyle,
  testID,
  ...rest
}: ButtonProps) {
  const [focused, setFocused] = useState(false);
  const isDisabled = Boolean(disabled || loading);
  const primary = variant === 'primary';
  const destructive = variant === 'destructive';
  const ghost = variant === 'ghost';

  const needsHitSlop =
    size === 'md' ? { vertical: space.sm, horizontal: space.sm } : undefined;

  const a11yState = {
    disabled: isDisabled,
    busy: loading,
    ...accessibilityState
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={a11yState}
      disabled={isDisabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      hitSlop={
        needsHitSlop
          ? {
              top: needsHitSlop.vertical,
              bottom: needsHitSlop.vertical,
              left: needsHitSlop.horizontal,
              right: needsHitSlop.horizontal
            }
          : undefined
      }
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.sizeLg : styles.sizeMd,
        ghost ? styles.ghost : null,
        !ghost && destructive
          ? styles.destructive
          : !ghost && primary
            ? styles.primary
            : !ghost
              ? styles.secondary
              : null,
        focused && !ghost ? styles.focusRing : null,
        isDisabled ? styles.disabled : pressed ? styles.pressed : null,
        style,
      ]}
      {...rest}
    >
      <View style={[styles.content, contentStyle]}>
        {loading ? (
          <Spinner
            size="small"
            color={
              primary && !destructive && !ghost
                ? colors.onAccent
                : destructive
                  ? colors.accent
                  : colors.label
            }
            accessibilityLabel="Đang xử lý"
          />
        ) : null}
        {children ??
          (label ? (
            <Text
              style={[
                styles.label,
                size === 'lg' ? styles.labelLg : null,
                destructive
                  ? styles.labelDestructive
                  : primary && !ghost
                    ? styles.labelOnAccent
                    : styles.labelDefault,
                loading ? styles.labelWithSpinner : null,
              ]}
            >
              {label}
            </Text>
          ) : null)}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sizeMd: {
    paddingVertical: space.md - 2,
    paddingHorizontal: space.lg + 2
  },
  sizeLg: {
    minHeight: 48,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg + 2
  },
  primary: {
    backgroundColor: colors.accent,
    borderWidth: 0
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.ink
  },
  destructive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    minHeight: MIN_TOUCH,
    paddingVertical: space.sm,
    paddingHorizontal: space.md
  },
  focusRing: {
    borderWidth: 2,
    borderColor: colors.focus
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    opacity: 0.85
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm
  },
  label: {
    ...typography.callout,
    fontFamily: fontFamilies.bodySemiBold,
    textAlign: 'center'
  },
  labelLg: {
    fontSize: typography.body.fontSize
  },
  labelOnAccent: {
    color: colors.onAccent
  },
  labelDefault: {
    color: colors.ink
  },
  labelDestructive: {
    color: colors.accent
  },
  labelWithSpinner: {
    opacity: 0.9
  }
});
