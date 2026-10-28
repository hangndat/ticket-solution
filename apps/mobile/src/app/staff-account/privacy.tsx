import { Redirect, type Href } from 'expo-router';
import { privacyPolicyHref } from '@/navigation/privacy-policy-navigation';

/** Legacy path → root pushed privacy screen (back button + swipe-back). */
export default function PrivacyRedirect() {
  return <Redirect href={privacyPolicyHref('staff') as Href} />;
}
