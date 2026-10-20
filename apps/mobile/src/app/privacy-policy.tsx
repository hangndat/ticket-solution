import { PrivacyPolicyWebViewScreen } from '@/screens/privacy-policy-webview';

/** Root stack — full screen, no tab bar (guest prototype parity). */
export default function PrivacyPolicyRoute() {
  return <PrivacyPolicyWebViewScreen presentation="root" />;
}
