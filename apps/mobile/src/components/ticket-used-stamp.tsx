import { StyleSheet, Text, View } from 'react-native';
import { attendeeWalletCopy } from '@/attendee/attendee-outcome-copy';
import { brand, colors } from '@/theme/colors';
import { space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

/**
 * Diagonal used-ticket watermark on the ticket face. Pointer-events none so
 * list rows stay tappable; VoiceOver uses the parent label.
 */
export function TicketUsedStamp() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.layer}
    >
      <View style={styles.badge}>
        <Text style={styles.label}>{attendeeWalletCopy.usedWatermark}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badge: {
    transform: [{ rotate: '-22deg' }],
    borderWidth: 2,
    borderColor: brand.destructive,
    borderRadius: 4,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    backgroundColor: colors.onAccent,
    opacity: 0.72,
  },
  label: {
    ...typography.title,
    color: brand.destructive,
    letterSpacing: 1.2,
  },
});
