import { STAFF_ACCOUNT_SEGMENT } from './staff-account-route.ts';

export type PostLogoutNavigationPlan =
  | { kind: 'none' }
  | { kind: 'guest-replace' };

export function planPostLogoutNavigation(input: {
  segments: readonly string[];
  staffWorkspace: boolean;
}): PostLogoutNavigationPlan {
  if (input.segments.some((s) => s === STAFF_ACCOUNT_SEGMENT)) {
    return { kind: 'guest-replace' };
  }
  if (input.staffWorkspace) {
    return { kind: 'guest-replace' };
  }
  return { kind: 'none' };
}
