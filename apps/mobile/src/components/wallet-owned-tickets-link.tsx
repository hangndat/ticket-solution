import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { countTicketsForEventId } from '@/tickets/wallet-event-grouping';
import { useAttendeeOwnedTickets } from '@/tickets/use-attendee-owned-tickets';
import { brand } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';

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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} cho sự kiện này. Xem vé.`}
      testID={testID}
      onPress={() =>
        router.push({
          pathname: '/(tabs)/my-tickets',
          params: { eventId },
        })
      }
      style={({ pressed }) =>
        cardRow
          ? {
              width: '100%',
              opacity: pressed ? 0.92 : 1,
              backgroundColor: '#f0f4f8',
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 14,
              alignItems: 'center',
            }
          : {
              alignSelf: 'flex-start',
              opacity: pressed ? 0.75 : 1,
              paddingVertical: 4,
            }
      }
    >
      <Text
        style={{
          color: brand.signal,
          fontSize: cardRow ? 16 : 15,
          fontFamily: fontFamilies.bodySemiBold,
          fontWeight: '600',
          textAlign: cardRow ? 'center' : 'left',
        }}
      >
        {label}
        {cardRow ? '' : ' · Xem vé →'}
      </Text>
    </Pressable>
  );
}
