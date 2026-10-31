import { Redirect, type Href } from 'expo-router';
import { ATTENDEE_ACCOUNT_HREF } from '@/navigation/attendee-account-route';

/** Legacy `/account` → unique root stack (hidden NativeTabs cannot open). */
export default function LegacyAttendeeAccountRedirect() {
  return <Redirect href={ATTENDEE_ACCOUNT_HREF as Href} />;
}
