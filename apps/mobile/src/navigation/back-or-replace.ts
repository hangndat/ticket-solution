import { router, type Href } from 'expo-router';
import { resolveBackOrReplace } from './back-or-replace-decision';

export function goBackOrReplace(fallbackHref: string): void {
  const action = resolveBackOrReplace(router.canGoBack(), fallbackHref);
  if (action.kind === 'back') {
    router.back();
    return;
  }
  router.replace(action.href as Href);
}
