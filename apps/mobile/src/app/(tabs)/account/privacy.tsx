import { Redirect } from 'expo-router';

/** Legacy tab path → root modal without tab bar. */
export default function AccountPrivacyRedirect() {
  return <Redirect href="/privacy-policy" />;
}
