import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from './validate.mjs';

const runId = 'mhh4h7g2-a1b2c3';
const suffix = `e2e-${runId}.test`;
const actors = [
  'attendee',
  'otherAttendee',
  'unverified',
  'owner',
  'manager',
  'cs',
  'scanner',
  'supervisor',
  'operator',
];

function fixture() {
  return {
    schemaVersion: 1,
    runId,
    origins: {
      web: `https://app.${suffix}:4443`,
      portal: `https://portal.${suffix}:4443`,
      marketing: `https://${suffix}:4443`,
      api: `https://api.${suffix}:4443`,
      auth: `https://auth.${suffix}:4443`,
      mailpit: `https://mailpit.${suffix}:4443`,
    },
    accounts: Object.fromEntries(
      actors.map((actor) => [
        actor,
        { username: `${actor}@example.test`, password: 'private-secret' },
      ]),
    ),
    cases: {
      'WEB-01': {
        tenantId: '9f755278-5ef9-4e72-8daa-a80fbfdc908f',
        tenantSlug: 'tenant-a',
        eventId: '5f66bc66-4ca7-48d7-90c2-2b46627da456',
        eventSlug: 'event-a',
        accounts: {
          attendee: { username: 'case@example.test', password: 'case-secret' },
        },
        data: { csvPath: '/tmp/e2e-run/import.csv' },
      },
    },
    runtime: { ownerRunId: runId, hostSuffix: suffix, dir: '/tmp/e2e-run' },
  };
}

function rejects(change, options) {
  const value = fixture();
  change(value);
  assert.throws(
    () => validateManifest(value, options),
    (error) => {
      assert.match(error.message, /^BLOCKED:/);
      assert.doesNotMatch(
        error.message,
        /private-secret|case-secret|https?:\/\//,
      );
      return true;
    },
  );
}

test('accepts a per-run HTTPS manifest and required case without changing it', () => {
  const value = fixture();
  assert.strictEqual(
    validateManifest(value, {
      requiredCaseIds: ['WEB-01'],
      runDir: '/tmp/e2e-run',
    }),
    value,
  );
  assert.equal(value.cases['WEB-01'].accounts.attendee.password, 'case-secret');
});

test('accepts Mailpit on explicit loopback HTTP port', () => {
  const value = fixture();
  value.origins.mailpit = 'http://127.0.0.1:8025';
  assert.strictEqual(validateManifest(value), value);
});

test('fault Portal must remain an isolated host in the same run', () => {
  const value = fixture();
  value.origins.faultPortal = `https://fault-portal.${suffix}:4443`;
  value.cases['WEB-01'].data.unconfiguredPortalOrigin =
    value.origins.faultPortal;
  assert.strictEqual(validateManifest(value), value);
  rejects((m) => {
    m.origins.faultPortal = 'https://portal.production.example';
  });
});

test('rejects production, shared dev, and wrong-run origins', () => {
  for (const target of [
    'https://example.com',
    'http://localhost:3000',
    'https://app.e2e-other.test',
  ]) {
    rejects((m) => {
      m.origins.web = target;
    });
  }
});

test('rejects credentials, paths, query, hash, and HTTP in production profile', () => {
  for (const target of [
    `https://user:pass@app.${suffix}:4443`,
    `https://app.${suffix}:4443/login`,
    `https://app.${suffix}:4443?next=/`,
    `https://app.${suffix}:4443#fragment`,
    `http://app.${suffix}:4443`,
  ])
    rejects((m) => {
      m.origins.web = target;
    });
});

test('rejects cross-run metadata and unknown control URLs', () => {
  rejects((m) => {
    m.runtime.ownerRunId = 'different-run';
  });
  rejects((m) => {
    m.runtime.hostSuffix = 'e2e-other.test';
  });
  rejects((m) => {
    m.runtime.issuerUrl = 'https://auth.e2e-other.test/realms/other';
  });
  rejects((m) => {
    m.origins.control = 'https://production.example.com';
  });
  const value = fixture();
  value.origins['private-secret'] = 'https://production.example.com';
  assert.throws(
    () => validateManifest(value),
    (error) => {
      assert.match(error.message, /^BLOCKED:/);
      assert.doesNotMatch(
        error.message,
        /private-secret|production\.example\.com/,
      );
      return true;
    },
  );
});

test('requires independently valid cases and actor credentials', () => {
  rejects(
    (m) => {
      delete m.cases['WEB-01'];
    },
    { requiredCaseIds: ['WEB-01'] },
  );
  rejects((m) => {
    m.cases['WEB-01'].tenantId = 'not-a-uuid';
  });
  rejects((m) => {
    m.cases['WEB-01'].eventSlug = 'Bad/slug';
  });
  rejects((m) => {
    delete m.accounts.operator;
  });
  rejects((m) => {
    m.cases['WEB-01'].accounts.attendee.password = '';
  });
});

test('checks fixture paths only with runDir', () => {
  rejects(
    (m) => {
      m.cases['WEB-01'].data.csvPath = '/tmp/other-run/import.csv';
    },
    { runDir: '/tmp/e2e-run' },
  );
  const value = fixture();
  value.cases['WEB-01'].data.csvPath = '/tmp/other-run/import.csv';
  assert.strictEqual(validateManifest(value), value);
});
