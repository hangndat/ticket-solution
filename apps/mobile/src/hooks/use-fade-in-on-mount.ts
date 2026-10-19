import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

/**
 * Phase 3 motion: fade-in panel (staff deny, redeem outcome). Respects Reduce Motion.
 */
export function useFadeInOnMount(active: boolean) {
  const [reduceMotionOs, setReduceMotionOs] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotionOs(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionOs,
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    if (reduceMotionOs) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [active, opacity, reduceMotionOs]);

  return { opacity, reduceMotionOs };
}
