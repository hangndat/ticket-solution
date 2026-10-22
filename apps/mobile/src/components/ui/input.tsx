import { forwardRef, useState, type ComponentRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle
} from 'react-native';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

type TextInputRef = ComponentRef<typeof TextInput>;

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  helper?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export const Input = forwardRef<TextInputRef, InputProps>(function Input(
  {
    label,
    error,
    helper,
    editable = true,
    accessibilityLabel,
    style,
    containerStyle,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const disabled = editable === false;
  const a11yLabel = accessibilityLabel ?? label;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label} accessibilityRole="text">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={a11yLabel}
        accessibilityState={{ disabled }}
        editable={editable}
        placeholderTextColor={colors.secondary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.field,
          focused && !error ? styles.fieldFocused : null,
          error ? styles.fieldError : null,
          disabled ? styles.fieldDisabled : null,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: space.xs + space.xxs
  },
  label: {
    color: colors.label,
    ...typography.body
  },
  field: {
    minHeight: 48,
    padding: space.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.card,
    color: colors.label,
    fontSize: typography.body.fontSize,
    fontFamily: fontFamilies.body,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  fieldFocused: {
    borderColor: colors.focus
  },
  fieldError: {
    borderColor: colors.deny
  },
  fieldDisabled: {
    opacity: 0.55
  },
  error: { ...typography.subhead, color: colors.deny,
    fontFamily: fontFamilies.body },
  helper: {
    color: colors.secondary,
    ...typography.caption
  }
});
