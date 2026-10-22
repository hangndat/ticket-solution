import {
  ActivityIndicator,
  StyleSheet,
  type ActivityIndicatorProps,
  type StyleProp,
  type ViewStyle
} from 'react-native';
import { colors } from '@/theme/colors';

export type SpinnerProps = Omit<ActivityIndicatorProps, 'accessibilityRole'> & {
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Branded ActivityIndicator — always pass an accessibility label in product UI. */
export function Spinner({
  size = 'small',
  color = colors.accent,
  accessibilityLabel = 'Đang tải',
  style,
  ...rest
}: SpinnerProps) {
  return (
    <ActivityIndicator
      size={size}
      color={color}
      accessibilityLabel={accessibilityLabel}
      style={[styles.root, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  root: {}
});
