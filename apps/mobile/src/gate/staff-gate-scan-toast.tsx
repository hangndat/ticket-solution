import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Text,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { GateScanStatusView } from './gate-scan-status-ui.ts';
import { SCAN_TOAST_FADE_MS } from './staff-gate-scan-feedback.ts';
import { colors } from '@/theme/colors';

function toneColor(tone: GateScanStatusView['tone']): string {
  if (tone === 'admit') return colors.admit;
  if (tone === 'deny') return colors.deny;
  if (tone === 'unknown') return colors.unknown;
  return colors.label;
}

export function StaffGateScanToast({
  active,
  visible,
  view,
  busy,
}: {
  /** Keep mounted through fade-out while parent still holds toast op. */
  active: boolean;
  visible: boolean;
  view: GateScanStatusView;
  busy: boolean;
}) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    if (visible) {
      if (reduceMotion) {
        opacity.setValue(1);
        return;
      }
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }
    if (reduceMotion) {
      opacity.setValue(0);
      return;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: SCAN_TOAST_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [active, visible, opacity, reduceMotion]);

  if (!active) return null;

  const tint = toneColor(view.tone);
  const showSpinner = busy || view.kind === 'processing';
  const a11yEnabled = visible || busy;

  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility={a11yEnabled ? 'yes' : 'no'}
      accessibilityElementsHidden={!a11yEnabled}
      accessibilityLiveRegion={a11yEnabled ? 'polite' : 'none'}
      accessibilityLabel={
        a11yEnabled ? `${view.label}. ${view.hint}` : undefined
      }
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        top: '38%',
        transform: [{ translateY: -40 }],
        opacity,
        alignItems: 'center',
        zIndex: 2,
      }}
    >
      <View
        style={{
          maxWidth: 320,
          width: '100%',
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 14,
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          gap: 6,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        {showSpinner ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <SymbolView name={view.symbol} size={36} tintColor={tint} />
        )}
        <Text
          style={{
            color: '#fff',
            fontSize: 17,
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          {view.label}
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 14,
            lineHeight: 19,
            textAlign: 'center',
          }}
          numberOfLines={3}
        >
          {view.hint}
        </Text>
      </View>
    </Animated.View>
  );
}
