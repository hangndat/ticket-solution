import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { LeadRecord } from '../types';

/** Override in tests via env. Default: cwd-relative durable JSONL (gitignored). */
export function resolveInterestPath(): string {
  const fromEnv = process.env.MARKETING_INTEREST_PATH?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(process.cwd(), '.data', 'marketing-interest.jsonl');
}

export async function appendLeadJsonl(
  record: LeadRecord,
): Promise<{ path: string }> {
  const path = resolveInterestPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return { path };
}

/** @deprecated use appendLeadJsonl — kept for tests */
export async function appendInterestRecord(
  record: LeadRecord | (LeadRecord['payload'] & { at: string; source: 'marketing-interest'; clientKey?: string }),
): Promise<{ path: string }> {
  if ('lead_id' in record) {
    return appendLeadJsonl(record);
  }
  const legacy: LeadRecord = {
    lead_id: 'legacy',
    at: record.at,
    locale: 'vi',
    payload: {
      name: record.name,
      email: record.email,
      org: record.org,
      role: record.role,
      note: record.note,
      consent: record.consent,
    },
    score: 0,
    tier: 'C',
    qualified: false,
    signals: [],
    idempotency_key: 'legacy',
    source: 'marketing-interest',
    ...(record.clientKey ? { client_key: record.clientKey } : {}),
  };
  return appendLeadJsonl(legacy);
}
