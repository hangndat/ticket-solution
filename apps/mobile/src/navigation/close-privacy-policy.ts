import { router, type Href } from 'expo-router';
import {
  resolvePrivacyDismissAction,
  type PrivacyPolicyOrigin,
} from './privacy-policy-navigation';

export function closePrivacyPolicy(origin: PrivacyPolicyOrigin = 'attendee', canGoBack = router.canGoBack()): void {
  const action = resolvePrivacyDismissAction(canGoBack, origin);
  if (action.kind === 'back') {
    router.back();
    return;
  }
  router.replace(action.pathname as Href);
}
