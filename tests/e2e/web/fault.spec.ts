import { writeFileSync } from 'node:fs';
import { test, expect, loadManifest, fixtureFor } from '../harness/fixtures';
import { eventPath, webUrl } from './helpers';

test('[WEB-10] public detail shows upstream failure and recovers after transport restoration', async ({
  page,
}) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'WEB-10');
  const control = manifest.runtime?.faultControlPath;
  if (typeof control !== 'string')
    throw new Error('BLOCKED: run fault control missing');
  const setFault = (enabled: boolean) =>
    writeFileSync(
      control,
      JSON.stringify({ ownerRunId: manifest.runId, apiUnavailable: enabled }),
      { mode: 0o600 },
    );
  try {
    setFault(true);
    await page.goto(webUrl(manifest, eventPath(fixture)));
    await expect(page.getByTestId('event-unreachable')).toBeVisible();
    await expect(page.getByTestId('event-published')).toHaveCount(0);
    setFault(false);
    await page.reload();
    await expect(page.getByTestId('event-published')).toBeVisible();
    await expect(page.getByTestId('event-unreachable')).toHaveCount(0);
  } finally {
    setFault(false);
  }
});
