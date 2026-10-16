import { Page, Notice } from '@/components/page';
export function StaffScreen() {
  return (
    <Page>
      <Notice title="Staff access is not connected">
        Staff tools require a verified identity, an active organization
        membership and event permissions from the server.
      </Notice>
      <Notice title="Foundation preview">
        No organization or event is selected for staff operations. Scanning and
        check-in are unavailable.
      </Notice>
    </Page>
  );
}
