import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

type Props = {
  disabled: boolean;
  onScan: (data: string) => void;
};

export function GateCamera({ disabled, onScan }: Props) {
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();

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

  const scanning = focused && !disabled;

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
    </View>
  );
}
