import { Redirect, type Href } from 'expo-router';
import { ATTENDEE_ACCOUNT_HREF } from '@/navigation/attendee-account-route';

export default function LegacyAttendeeAccountDeleteRedirect() {
  return <Redirect href={`${ATTENDEE_ACCOUNT_HREF}/delete` as Href} />;
}
