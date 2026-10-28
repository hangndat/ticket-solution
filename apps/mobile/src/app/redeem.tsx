import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { attendeeRedeemHref } from '@/navigation/attendee-redeem-entry';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Legacy `/redeem` → attendee redeem tab (preserve `?code=`). */
export default function RedeemRoute() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  return <Redirect href={attendeeRedeemHref(firstParam(code)) as Href} />;
}
