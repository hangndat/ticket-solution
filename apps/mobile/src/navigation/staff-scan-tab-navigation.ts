import { type Href, router } from 'expo-router';
import { STAFF_DEFAULT_SCAN_HREF } from './staff-default-tab-target.ts';
import { requestStaffScanTabLanding } from './staff-scan-tab-landing.ts';

export {
  clearStaffScanTabLanding,
  consumeStaffScanTabLanding,
  peekStaffScanTabLanding,
  requestStaffScanTabLanding,
  subscribeStaffScanTabLanding,
} from './staff-scan-tab-landing.ts';

/** Return from root `/staff-account` or gate toolbar → Scan tab (not Manual). */
export function returnToStaffGateScanTab(): void {
  requestStaffScanTabLanding();
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(STAFF_DEFAULT_SCAN_HREF as Href);
}
