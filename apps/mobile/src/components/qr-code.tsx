import { useMemo } from 'react';
import { View } from 'react-native';
import { encodeQrModules } from '@/tickets/qr-matrix';

type Props = {
  value: string;
  size?: number;
  /** Quiet-zone modules around the code (default 2). */
  quietZone?: number;
};

/**
 * Pure View QR matrix — works offline, no native SVG / lockfile deps.
 * Not a Gate credential renderer; callers supply display payload strings.
 */
export function QrCode({ value, size = 220, quietZone = 2 }: Props) {
  const modules = useMemo(() => encodeQrModules(value), [value]);
  const dim = modules.length;
  const total = dim + quietZone * 2;
  const cell = size / total;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Ticket display QR code"
      style={{
        width: size,
        height: size,
        backgroundColor: '#fff',
        alignSelf: 'center',
      }}
    >
      {modules.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <View
              key={`${y}-${x}`}
              style={{
                position: 'absolute',
                left: (x + quietZone) * cell,
                top: (y + quietZone) * cell,
                width: cell,
                height: cell,
                backgroundColor: '#000',
              }}
            />
          ) : null,
        ),
      )}
    </View>
  );
}
