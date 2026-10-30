import { isAbsolute, relative, resolve } from 'node:path';
import { validateSourceProvenance } from '../harness/source-provenance.mjs';

const ACTORS = [
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
const HOSTS = {
  web: 'app',
  portal: 'portal',
  marketing: '',
  api: 'api',
  auth: 'auth',
  mailpit: 'mailpit',
  faultPortal: 'fault-portal',
  shortWeb: 'short-web',
};
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const CASE_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/;

function blocked(field, reason) {
  throw new Error(`BLOCKED: ${field} ${reason}`);
}

function record(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    blocked(field, 'must be an object');
  return value;
}

function label(value, field) {
  if (typeof value !== 'string' || !LABEL.test(value))
    blocked(field, 'must be a DNS label');
}

function url(value, field) {
  if (typeof value !== 'string') blocked(field, 'must be a URL');
  try {
    return new URL(value);
  } catch {
    blocked(field, 'must be a URL');
  }
}

function origin(value, field, host, allowLoopback = false) {
  const parsed = url(value, field);
  const loopback =
    allowLoopback &&
    parsed.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) &&
    parsed.port !== '';
  if (!loopback && (parsed.protocol !== 'https:' || parsed.hostname !== host)) {
    blocked(field, 'must use the isolated HTTPS host');
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/' ||
    value !== parsed.origin
  ) {
    blocked(
      field,
      'must be a bare origin without credentials, path, query, or hash',
    );
  }
  return parsed.origin;
}

function account(value, field) {
  const item = record(value, field);
  if (
    typeof item.username !== 'string' ||
    !item.username.trim() ||
    typeof item.password !== 'string' ||
    !item.password
  )
    blocked(field, 'requires username and password strings');
  for (const key of ['userId', 'totpSecret']) {
    if (
      item[key] !== undefined &&
      (typeof item[key] !== 'string' || !item[key])
    )
      blocked(`${field}.${key}`, 'must be a nonempty string');
  }
}

function withinRun(path, field, runDir) {
  if (typeof path !== 'string' || !path || !isAbsolute(path))
    blocked(field, 'must be an absolute run path');
  const rel = relative(runDir, resolve(path));
  if (
    rel === '..' ||
    rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(rel)
  ) {
    blocked(field, 'must remain inside runDir');
  }
}

function checkControls(value, field, allowedOrigins, runDir) {
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    const name = `${field}.${key}`;
    if (typeof entry === 'string') {
      if (
        /(?:url|origin|issuer|endpoint)$/i.test(key) &&
        /^https?:/i.test(entry)
      ) {
        const parsed = url(entry, 'control URL');
        if (
          !allowedOrigins.has(parsed.origin) ||
          parsed.username ||
          parsed.password
        )
          blocked('control URL', 'must use an approved run origin');
      }
      if (runDir && /(?:path|dir)$/i.test(key))
        withinRun(entry, 'run path', runDir);
    } else if (entry && typeof entry === 'object') {
      checkControls(entry, name, allowedOrigins, runDir);
    }
  }
}

/** Validate an isolated E2E manifest without modifying it or exposing credentials in errors. */
export function validateManifest(value, options = {}) {
  const manifest = record(value, 'manifest');
  if (manifest.schemaVersion !== 1) blocked('schemaVersion', 'must be 1');
  label(manifest.runId, 'runId');
  if (manifest.runId.length > 59)
    blocked('runId', 'is too long for an E2E hostname');
  const suffix = `e2e-${manifest.runId}.test`;
  const origins = record(manifest.origins, 'origins');
  const allowedOrigins = new Set();
  for (const [key, prefix] of Object.entries(HOSTS)) {
    if (['faultPortal', 'shortWeb'].includes(key) && origins[key] === undefined)
      continue;
    const host = prefix ? `${prefix}.${suffix}` : suffix;
    allowedOrigins.add(
      origin(origins[key], `origins.${key}`, host, key === 'mailpit'),
    );
  }
  for (const key of Object.keys(origins)) {
    if (!(key in HOSTS))
      blocked('origins', 'contains an unapproved control origin');
  }
  if (
    options.runDir !== undefined &&
    (typeof options.runDir !== 'string' || !isAbsolute(options.runDir))
  ) {
    blocked('options.runDir', 'must be an absolute path');
  }
  const runDir = options.runDir && resolve(options.runDir);
  if (manifest.runtime !== undefined) {
    const runtime = record(manifest.runtime, 'runtime');
    if (
      runtime.ownerRunId !== undefined &&
      runtime.ownerRunId !== manifest.runId
    )
      blocked('runtime.ownerRunId', 'must match runId');
    if (runtime.hostSuffix !== undefined && runtime.hostSuffix !== suffix)
      blocked('runtime.hostSuffix', 'must match runId');
    checkControls(runtime, 'runtime', allowedOrigins, runDir);
    if (runtime.sourceProvenance !== undefined) {
      validateSourceProvenance(runtime.sourceProvenance);
    }
  }
  const accounts = record(manifest.accounts, 'accounts');
  for (const actor of ACTORS) account(accounts[actor], `accounts.${actor}`);
  const cases = record(manifest.cases, 'cases');
  if (
    options.requiredCaseIds !== undefined &&
    !Array.isArray(options.requiredCaseIds)
  )
    blocked('options.requiredCaseIds', 'must be an array');
  for (const caseId of options.requiredCaseIds || []) {
    if (typeof caseId !== 'string' || !CASE_ID.test(caseId))
      blocked('options.requiredCaseIds', 'contains an invalid case ID');
    if (!Object.hasOwn(cases, caseId))
      blocked('cases', 'is missing a required fixture');
  }
  for (const [caseId, item] of Object.entries(cases)) {
    if (!CASE_ID.test(caseId)) blocked('cases', 'contains an invalid case ID');
    const fixture = record(item, `cases.${caseId}`);
    for (const key of ['tenantId', 'eventId']) {
      if (typeof fixture[key] !== 'string' || !UUID.test(fixture[key]))
        blocked(`cases.${caseId}.${key}`, 'must be a UUID');
    }
    for (const key of ['tenantSlug', 'eventSlug'])
      label(fixture[key], `cases.${caseId}.${key}`);
    if (fixture.accounts !== undefined) {
      const overrides = record(fixture.accounts, `cases.${caseId}.accounts`);
      for (const [actor, item] of Object.entries(overrides)) {
        if (!ACTORS.includes(actor))
          blocked(`cases.${caseId}.accounts`, 'contains an unknown actor');
        account(item, `cases.${caseId}.accounts.${actor}`);
      }
    }
    if (fixture.data !== undefined)
      record(fixture.data, `cases.${caseId}.data`);
    if (runDir && fixture.csvPath !== undefined)
      withinRun(fixture.csvPath, `cases.${caseId}.csvPath`, runDir);
    checkControls(fixture.data, `cases.${caseId}.data`, allowedOrigins, runDir);
  }
  return manifest;
}
