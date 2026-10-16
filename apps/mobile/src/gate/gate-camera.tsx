import { CameraView, useCameraPermissions } from 'expo-camera';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

type Props = {
  disabled: boolean;
  onScan: (data: string) => void;
};

export function GateCamera({ disabled, onScan }: Props) {
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
          Allow camera to scan ticket QR
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={{ height: 240, borderRadius: 16, overflow: 'hidden' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          disabled
            ? undefined
            : (result) => {
                if (result.data) onScan(result.data);
              }
        }
      />
    </View>
  );
}
