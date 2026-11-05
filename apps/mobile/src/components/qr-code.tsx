import { useMemo } from 'react';
import { View } from 'react-native';
import { encodeQrModules } from '@/tickets/qr-matrix';
import { brand, colors } from '@/theme/colors';
import { qrDarkRuns } from './qr-runs';

type Props = {
  value: string;
  size?: number;
  /** Quiet-zone modules around the code (default 2). */
  quietZone?: number;
  /** Module / background colors — defaults to Vemoki ink on paper. */
  inkColor?: string;
  paperColor?: string;
  /** AC-T1 — prefer «Mã QR vé [sự kiện]»; default generic label. */
  accessibilityLabel?: string;
};

/**
 * Pure View QR matrix — works offline, no native SVG / lockfile deps.
 * Not a Gate credential renderer; callers supply display payload strings.
 */
export function QrCode({
  value,
  size = 220,
  quietZone = 2,
  inkColor = brand.ink,
  paperColor = colors.onAccent,
  accessibilityLabel = 'Mã QR hiển thị vé'
}: Props) {
  const modules = useMemo(() => encodeQrModules(value), [value]);
  const runs = useMemo(() => qrDarkRuns(modules), [modules]);
  const dim = modules.length;
  const total = dim + quietZone * 2;
  const cell = size / total;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        backgroundColor: paperColor,
        alignSelf: 'center'
      }}
    >
      {runs.map((run) => (
        <View
          key={`${run.y}-${run.x}`}
          style={{
            position: 'absolute',
            left: (run.x + quietZone) * cell,
            top: (run.y + quietZone) * cell,
            width: run.width * cell,
            height: cell,
            backgroundColor: inkColor
          }}
        />
      ))}
    </View>
  );
}
