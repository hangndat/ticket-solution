import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const TTL_MS = 24 * 60 * 60 * 1000;

type IdempotencyEntry = {
  lead_id: string;
  at: string;
};

type IdempotencyStore = Record<string, IdempotencyEntry>;

export function resolveIdempotencyStorePath(): string {
  const fromEnv = process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(process.cwd(), '.data', 'marketing-interest-idempotency.json');
}

export function buildIdempotencyKey(
  email: string,
  opts?: { headerKey?: string; clientSubmitId?: string },
): string {
  const header = opts?.headerKey?.trim();
  if (header) return header;
  const clientId = opts?.clientSubmitId?.trim();
  if (clientId) return clientId;
  const normalized = email.trim().toLowerCase();
  const utcDate = new Date().toISOString().slice(0, 10);
  return createHash('sha256')
    .update(`${normalized}|${utcDate}`)
    .digest('hex');
}

async function loadStore(): Promise<IdempotencyStore> {
  const path = resolveIdempotencyStorePath();
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as IdempotencyStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function prune(store: IdempotencyStore): IdempotencyStore {
  const now = Date.now();
  const out: IdempotencyStore = {};
  for (const [key, entry] of Object.entries(store)) {
    const at = Date.parse(entry.at);
    if (!Number.isNaN(at) && now - at < TTL_MS) {
      out[key] = entry;
    }
  }
  return out;
}

export async function lookupIdempotency(
  key: string,
): Promise<IdempotencyEntry | null> {
  const store = prune(await loadStore());
  return store[key] ?? null;
}

export async function rememberIdempotency(
  key: string,
  lead_id: string,
): Promise<void> {
  const path = resolveIdempotencyStorePath();
  const store = prune(await loadStore());
  store[key] = { lead_id, at: new Date().toISOString() };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(store)}\n`, 'utf8');
}
