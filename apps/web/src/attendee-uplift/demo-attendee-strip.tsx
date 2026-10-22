import { DemoDataBanner } from '@ticket/ui';
import { isDemoDataStripEnabled } from './env';

export function DemoAttendeeStrip({
  env = process.env,
}: {
  env?: NodeJS.ProcessEnv;
}) {
  if (!isDemoDataStripEnabled(env)) return null;
  return (
    <DemoDataBanner>
      <strong>Dữ liệu mô phỏng</strong>
      <span aria-hidden="true"> · </span>
      <span className="demo-data-strip__meta">app.vemoki.com · PD 2026-10-22</span>
    </DemoDataBanner>
  );
}
