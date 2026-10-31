import { type Href, router } from 'expo-router';
import { staffEligibility } from '../identity/staff-eligibility.ts';
import { GUEST_HOME_HREF } from './attendee-account-route.ts';
import { clearStaffScanTabLanding } from './staff-scan-tab-landing.ts';
import type { PostLogoutNavigationPlan } from './post-logout-plan.ts';

export { planPostLogoutNavigation } from './post-logout-plan.ts';
export type { PostLogoutNavigationPlan } from './post-logout-plan.ts';

export const GUEST_EVENTS_HREF = GUEST_HOME_HREF;

export function runPostLogoutNavigation(plan: PostLogoutNavigationPlan): void {
  staffEligibility.reset();
  clearStaffScanTabLanding();
  if (plan.kind === 'none') return;
  router.replace(GUEST_EVENTS_HREF as Href);
}
