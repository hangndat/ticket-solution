import { Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

/** Ticket state chip — ví list + ticket detail (Live Pulse admit surface). */
export function TicketStatusPill({ label }: { label: string }) {
  return (
    <View
      accessibilityRole="text"
      style={{
        alignSelf: 'flex-start',
        backgroundColor: colors.admitSurface,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs
      }}
    >
      <Text
        style={{
          ...typography.badge,
          color: colors.admit,
          fontFamily: fontFamilies.bodySemiBold
        }}
      >
        {label}
      </Text>
    </View>
  );
}
