import { Redirect } from 'expo-router';
import { ATTENDEE_ACCOUNT_HREF } from '@/navigation/attendee-account-route';

/** Hidden tab path → root account stack. */
export default function AccountTabRedirect() {
  return <Redirect href={ATTENDEE_ACCOUNT_HREF} />;
}
