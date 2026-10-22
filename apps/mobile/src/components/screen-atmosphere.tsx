import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { brand, radius } from '@/theme/tokens';

/**
 * Live Pulse screen wash — paper → paperDeep + faint signal radial (no flat fill).
 * Pointer-events none so lists / CTAs stay hittable.
 */
export function AtmosphereWash() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: brand.paperDeep, opacity: 0.45 },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          top: -40,
          right: -60,
          width: 280,
          height: 280,
          borderRadius: radius.pill,
          backgroundColor: brand.signal,
          opacity: 0.07
        }}
      />
    </View>
  );
}

/** Flex root with Live Pulse atmosphere behind children. */
export function ScreenAtmosphere({
  children,
  style
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <View style={[{ flex: 1, backgroundColor: brand.paper }, style]}>
      <AtmosphereWash />
      {children}
    </View>
  );
}
