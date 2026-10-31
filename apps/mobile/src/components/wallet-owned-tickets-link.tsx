import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ui/button';
import { countTicketsForEventId } from '@/tickets/wallet-event-grouping';
import { useAttendeeOwnedTickets } from '@/tickets/use-attendee-owned-tickets';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { radius, space } from '@/theme/tokens';
import { typography } from '@/theme/typography';

type Props = {
  eventId: string;
  testID?: string;
  /** Full-width row inside event cards (mock `owned-link`). */
  variant?: 'inline' | 'card-row';
};

export function WalletOwnedTicketsLink({
  eventId,
  testID,
  variant = 'inline'
}: Props) {
  const { tickets, verified } = useAttendeeOwnedTickets();
  if (!verified) return null;
  const count = countTicketsForEventId(tickets, eventId);
  if (count < 1) return null;

  const label = `Bạn có ${count} vé`;
  const cardRow = variant === 'card-row';
  const linkLabel = cardRow ? label : `${label} · Xem vé →`;

  return (
    <Button
      variant="ghost"
      testID={testID}
      accessibilityLabel={`${label} cho sự kiện này. Xem vé.`}
      onPress={() =>
        router.push({
          pathname: '/(tabs)/my-tickets',
          params: { eventId }
        })
      }
      style={cardRow ? styles.cardRow : styles.inline}
      contentStyle={cardRow ? styles.cardRowContent : undefined}
    >
      <Text style={cardRow ? styles.cardRowText : styles.inlineText}>
        {linkLabel}
      </Text>
    </Button>
  );
}

const styles = StyleSheet.create({
  inline: {
    alignSelf: 'flex-start',
    paddingVertical: space.xs,
    paddingHorizontal: 0
  },
  inlineText: { ...typography.subhead, color: brand.primary,
    fontFamily: fontFamilies.bodySemiBold,
    textAlign: 'left' },
  cardRow: {
    width: '100%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.sm + 2,
    paddingVertical: space.md,
    paddingHorizontal: space.md + 2
  },
  cardRowContent: {
    width: '100%'
  },
  cardRowText: { ...typography.callout, color: brand.primary,
    fontFamily: fontFamilies.bodySemiBold,
    textAlign: 'center' }
});
