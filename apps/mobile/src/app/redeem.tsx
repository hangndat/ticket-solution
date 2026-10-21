import { Redirect } from 'expo-router';
import { ATTENDEE_REDEEM_PATH } from '@/navigation/attendee-redeem-entry';

/** Attendee `/redeem` always uses global single-code flow (no scoped operator UI). */
export default function RedeemRoute() {
  return <Redirect href={ATTENDEE_REDEEM_PATH} />;
}
