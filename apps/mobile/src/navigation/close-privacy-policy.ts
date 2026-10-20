import { router } from 'expo-router';
import { resolvePrivacyDismissAction } from './privacy-policy-navigation';

export function closePrivacyPolicy(): void {
  const action = resolvePrivacyDismissAction(router.canGoBack());
  if (action.kind === 'back') {
    router.back();
    return;
  }
  router.replace(action.pathname);
}
