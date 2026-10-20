import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { countTicketsForEventId } from '@/tickets/wallet-event-grouping';
import { useAttendeeOwnedTickets } from '@/tickets/use-attendee-owned-tickets';
import { brand } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';

type Props = {
  eventId: string;
  testID?: string;
};

export function WalletOwnedTicketsLink({ eventId, testID }: Props) {
  const { tickets, verified } = useAttendeeOwnedTickets();
  if (!verified) return null;
  const count = countTicketsForEventId(tickets, eventId);
  if (count < 1) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Bạn có ${count} vé cho sự kiện này. Xem vé.`}
      testID={testID}
      onPress={() =>
        router.push({
          pathname: '/(tabs)/my-tickets',
          params: { eventId },
        })
      }
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        opacity: pressed ? 0.75 : 1,
        paddingVertical: 4,
      })}
    >
      <Text
        style={{
          color: brand.signal,
          fontSize: 15,
          fontFamily: fontFamilies.bodySemiBold,
          fontWeight: '600',
        }}
      >
        Bạn có {count} vé · Xem vé →
      </Text>
    </Pressable>
  );
}
