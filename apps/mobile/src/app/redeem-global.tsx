import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { attendeeRedeemHref } from '@/navigation/attendee-redeem-entry';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `/redeem-global` deep links and notifications → redeem tab. */
export default function GlobalRedeemRedirect() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  return <Redirect href={attendeeRedeemHref(firstParam(code)) as Href} />;
}
