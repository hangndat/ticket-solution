import { DemoDataBanner } from '@ticket/ui';
import { isDemoDataStripEnabled } from './env';

export function DemoAttendeeStrip({
  env = process.env,
}: {
  env?: NodeJS.ProcessEnv;
}) {
  if (!isDemoDataStripEnabled(env)) return null;
  return <DemoDataBanner />;
}
