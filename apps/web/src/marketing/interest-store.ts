import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { InterestPayload } from './interest-validate';

export type InterestRecord = InterestPayload & {
  at: string;
  source: 'marketing-interest';
  clientKey?: string;
};

/** Override in tests via env. Default: cwd-relative durable JSONL (gitignored). */
export function resolveInterestPath(): string {
  const fromEnv = process.env.MARKETING_INTEREST_PATH?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(process.cwd(), '.data', 'marketing-interest.jsonl');
}

export async function appendInterestRecord(
  record: InterestRecord,
): Promise<{ path: string }> {
  const path = resolveInterestPath();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return { path };
}

/**
 * Optional ops notify (zero new deps). Failures are logged; persistence already done.
 * Set MARKETING_INTEREST_WEBHOOK_URL to a bridge that emails/Slack/n8n.
 */
export async function notifyInterestWebhook(
  record: InterestRecord,
): Promise<{ notified: boolean; status?: number; error?: string }> {
  const url = process.env.MARKETING_INTEREST_WEBHOOK_URL?.trim();
  if (!url) return { notified: false };

  const secret = process.env.MARKETING_INTEREST_WEBHOOK_SECRET?.trim();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-vemoki-interest-secret': secret } : {}),
      },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return { notified: false, status: res.status, error: `HTTP ${res.status}` };
    }
    return { notified: true, status: res.status };
  } catch (err) {
    return {
      notified: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function persistInterestSubmission(
  value: InterestPayload,
  opts?: { clientKey?: string },
): Promise<InterestRecord> {
  const record: InterestRecord = {
    ...value,
    at: new Date().toISOString(),
    source: 'marketing-interest',
    ...(opts?.clientKey ? { clientKey: opts.clientKey } : {}),
  };
  await appendInterestRecord(record);
  const notify = await notifyInterestWebhook(record);
  if (notify.error) {
    console.warn(
      '[marketing-interest] webhook notify failed (submission persisted):',
      notify.error,
    );
  }
  return record;
}
