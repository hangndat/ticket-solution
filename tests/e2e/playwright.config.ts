import { defineConfig } from 'playwright/test';
import { resolve } from 'node:path';

const runDir = process.env.E2E_RUN_DIR;
const trust = process.env.E2E_TLS_SPKI;
const suffix = process.env.E2E_HOST_SUFFIX;

export default defineConfig({
  testDir: '.',
  testMatch: [
    'web/**/*.spec.ts',
    'portal/**/*.spec.ts',
    'harness/security.spec.ts',
  ],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: Number(process.env.E2E_WORKERS || 1),
  retries: 0,
  forbidOnly: true,
  outputDir: runDir
    ? resolve(runDir, 'test-output')
    : '.artifacts/discovery-output',
  reporter: [
    ['line'],
    [
      'json',
      {
        outputFile: runDir
          ? resolve(runDir, 'results.json')
          : '.artifacts/results.json',
      },
    ],
  ],
  use: {
    browserName: 'chromium',
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Raw trace/video can retain cookies and QR; reports stay private local.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    ignoreHTTPSErrors: false,
    launchOptions: {
      args: [
        ...(suffix
          ? [
              `--host-resolver-rules=MAP *.${suffix} 127.0.0.1, MAP ${suffix} 127.0.0.1`,
            ]
          : []),
        ...(trust ? [`--ignore-certificate-errors-spki-list=${trust}`] : []),
      ],
    },
  },
});
