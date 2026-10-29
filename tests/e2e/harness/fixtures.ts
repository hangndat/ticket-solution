import { readFileSync } from 'node:fs';
import type {
  E2EManifest,
  CaseFixture,
  ActorName,
  TestAccount,
} from './contract';
import { validateManifest } from '../validation/validate.mjs';
export { test, expect } from 'playwright/test';

export function loadManifest(): E2EManifest {
  const path = process.env.E2E_MANIFEST;
  if (!path)
    throw new Error('BLOCKED: E2E_MANIFEST chưa được tạo bởi local harness');
  return validateManifest(JSON.parse(readFileSync(path, 'utf8')));
}

export function fixtureFor(manifest: E2EManifest, caseId: string): CaseFixture {
  const fixture = manifest.cases[caseId];
  if (!fixture) throw new Error(`BLOCKED: thiếu fixture độc lập cho ${caseId}`);
  return fixture;
}

export function accountFor(
  manifest: E2EManifest,
  caseId: string,
  actor: ActorName,
): TestAccount {
  return (
    fixtureFor(manifest, caseId).accounts?.[actor] ?? manifest.accounts[actor]
  );
}
