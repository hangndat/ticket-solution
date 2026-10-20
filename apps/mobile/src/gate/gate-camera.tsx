import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  Text,
  View,
} from 'react-native';
import { colors } from '@/theme/colors';

const FRAME_SIZE = 220;
const SCAN_SWEEP_MS = 1900;
const SCAN_LINE_TOP = 12;
const SCAN_LINE_INSET = 10;
const SCAN_SWEEP_TRAVEL = 190;
const SCAN_LINE_REST_Y = 95;

type Props = {
  disabled: boolean;
  onScan: (data: string) => void;
};

export function GateCamera({ disabled, onScan }: Props) {
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLineY] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  const granted = permission?.granted === true;
  const scanning = granted && focused && !disabled;

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
    if (!scanning) {
      scanLineY.stopAnimation();
      scanLineY.setValue(0);
      return;
    }
    if (reduceMotion) {
      scanLineY.stopAnimation();
      scanLineY.setValue(SCAN_LINE_REST_Y);
      return;
    }

    scanLineY.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, {
          toValue: SCAN_SWEEP_TRAVEL,
          duration: SCAN_SWEEP_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineY, {
          toValue: 0,
          duration: SCAN_SWEEP_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      scanLineY.stopAnimation();
    };
  }, [scanning, reduceMotion, scanLineY]);

  if (!permission) {
    return null;
  }
  if (!permission.granted) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => void requestPermission()}
        style={{ padding: 14, borderRadius: 12, backgroundColor: colors.card }}
      >
        <Text style={{ color: colors.label, fontSize: 17, textAlign: 'center' }}>
          Cho phép camera để quét QR vé
        </Text>
      </Pressable>
    );
  }

  const scanLineMotionStyle = reduceMotion
    ? { transform: [{ translateY: SCAN_LINE_REST_Y }] }
    : { transform: [{ translateY: scanLineY }] };

  const scanLineGlow =
    scanning && !reduceMotion
      ? {
          shadowColor: '#fb7391',
          shadowOpacity: 0.5,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
        }
      : null;

  return (
    <View style={{ height: 240, borderRadius: 16, overflow: 'hidden' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        // Pause the session when the Staff route blurs (navigate away / background).
        active={focused}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          scanning
            ? (result) => {
                if (result.data) onScan(result.data);
              }
            : undefined
        }
      />
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: scanning ? 1 : 0,
        }}
      >
        <View
          style={{
            width: FRAME_SIZE,
            height: FRAME_SIZE,
            borderWidth: 3,
            borderColor: 'rgba(255,255,255,0.6)',
            borderRadius: 24,
          }}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: SCAN_LINE_INSET,
                right: SCAN_LINE_INSET,
                top: SCAN_LINE_TOP,
                height: 2,
                backgroundColor: '#fb7391',
              },
              scanLineMotionStyle,
              scanLineGlow,
            ]}
          />
        </View>
      </View>
    </View>
  );
}
