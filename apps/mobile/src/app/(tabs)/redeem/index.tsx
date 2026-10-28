import { redeemCopy } from '@/components/screen-state-copy';
import { AttendeeScreenChrome } from '@/navigation/attendee-screen-chrome';
import { GlobalRedeemScreen } from '@/screens/global-redeem';

export default function RedeemTabRoute() {
  return (
    <>
      <GlobalRedeemScreen />
      <AttendeeScreenChrome title={redeemCopy.screenTitle} />
    </>
  );
}
