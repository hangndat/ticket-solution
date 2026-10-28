import { Redirect, type Href } from 'expo-router';
import { GUEST_HOME_HREF } from '@/navigation/attendee-account-route';

/** Guest home is the public Events catalog (O28). */
export default function WelcomeRoute() {
  return <Redirect href={GUEST_HOME_HREF as Href} />;
}
