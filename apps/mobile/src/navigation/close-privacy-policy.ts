import { router, type Href } from 'expo-router';
import {
  resolvePrivacyDismissAction,
  type PrivacyPolicyOrigin,
} from './privacy-policy-navigation';
import { STAFF_ACCOUNT_HREF } from './staff-account-route';

export function closePrivacyPolicy(
  origin: PrivacyPolicyOrigin = 'attendee',
  canGoBack = router.canGoBack(),
): void {
  const action = resolvePrivacyDismissAction(canGoBack, origin);
  if (action.kind === 'back') {
    router.back();
    return;
  }
  if (origin === 'staff') {
    router.replace({
      pathname: STAFF_ACCOUNT_HREF,
      params: { fromPrivacyCold: '1' },
    });
    return;
  }
  router.replace(action.pathname as Href);
}
