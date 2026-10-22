import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ui/button';
import { countTicketsForEventId } from '@/tickets/wallet-event-grouping';
import { useAttendeeOwnedTickets } from '@/tickets/use-attendee-owned-tickets';
import { brand } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { radius, space } from '@/theme/tokens';

type Props = {
  eventId: string;
  testID?: string;
  /** Full-width row inside event cards (mock `owned-link`). */
  variant?: 'inline' | 'card-row';
};

export function WalletOwnedTicketsLink({
  eventId,
  testID,
  variant = 'inline',
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
          params: { eventId },
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
    paddingHorizontal: 0,
  },
  inlineText: {
    color: brand.signal,
    fontSize: 15,
    fontFamily: fontFamilies.bodySemiBold,
    fontWeight: '600',
    textAlign: 'left',
  },
  cardRow: {
    width: '100%',
    backgroundColor: '#f0f4f8',
    borderRadius: radius.sm + 2,
    paddingVertical: space.md,
    paddingHorizontal: space.md + 2,
  },
  cardRowContent: {
    width: '100%',
  },
  cardRowText: {
    color: brand.signal,
    fontSize: 16,
    fontFamily: fontFamilies.bodySemiBold,
    fontWeight: '600',
    textAlign: 'center',
  },
});
