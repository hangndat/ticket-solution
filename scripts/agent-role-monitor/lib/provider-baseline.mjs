/**
 * Provider JSONL baseline snapshots for task-boundary token deltas.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { writeSecureFile } from './telemetry-ledger.mjs';
import { providerFileMetadata } from './provider-file.mjs';

export const PROVIDER_BASELINE_SCHEMA = 'telemetry-provider-baseline/v1';

export function fileIdentityHash(meta) {
  return createHash('sha256')
    .update(`${meta.basename}|${meta.byteSize}|${meta.mtimeMs}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * @param {object} meta providerFileMetadata result
 * @param {string} threadId
 * @param {object} cumulative internal breakdown or public tokens
 * @param {{ byteOffset?: number, model?: string|null, provider?: string|null }} [extra]
 */
export function buildProviderBaseline(meta, threadId, cumulative, extra = {}) {
  const capturedAt = new Date().toISOString();
  return {
    schema: PROVIDER_BASELINE_SCHEMA,
    capturedAt,
    thread_id: threadId,
    file: {
      basename: meta.basename,
      byteSize: meta.byteSize,
      mtimeMs: meta.mtimeMs,
      identity: fileIdentityHash(meta),
      prefixSha256: extra.prefixSha256 ?? null,
    },
    byte_offset: extra.byteOffset ?? meta.byteSize,
    model: extra.model ?? null,
    provider: extra.provider ?? 'codex',
    cumulative: {
      input: cumulative.input ?? cumulative.inputTokens ?? null,
      cachedInput: cumulative.cachedInput ?? cumulative.cachedInputTokens ?? null,
      output: cumulative.output ?? cumulative.outputTokens ?? null,
      reasoning: cumulative.reasoning ?? cumulative.reasoningOutputTokens ?? null,
    },
  };
}

export function loadProviderBaseline(baselinePath) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(baselinePath), 'utf8'));
  if (raw.schema !== PROVIDER_BASELINE_SCHEMA) {
    throw new Error('baseline schema must be telemetry-provider-baseline/v1');
  }
  return raw;
}

/**
 * @param {object} baseline
 * @param {object} meta current file metadata
 * @param {string} threadId
 */
export function validateBaselineIdentity(baseline, meta, threadId) {
  const errors = [];
  if (baseline.thread_id !== threadId) {
    errors.push({ code: 'BASELINE_THREAD_MISMATCH', message: 'thread_id does not match baseline' });
  }
  if (baseline.file?.basename !== meta.basename || meta.byteSize < baseline.byte_offset) {
    errors.push({ code: 'BASELINE_FILE_IDENTITY_MISMATCH', message: 'provider file identity changed' });
  }
  const captured = Date.parse(baseline.capturedAt);
  if (!Number.isFinite(captured)) {
    errors.push({ code: 'BASELINE_TIME_INVALID', message: 'baseline capturedAt invalid' });
  } else if (captured > Date.now()) {
    errors.push({ code: 'BASELINE_TIME_FUTURE', message: 'baseline capturedAt in the future' });
  }
  return errors;
}

export function assertMonotonicCumulative(baselineCumulative, endCumulative) {
  const errors = [];
  for (const k of ['input', 'cachedInput', 'output', 'reasoning']) {
    const b = baselineCumulative?.[k];
    const e = endCumulative?.[k];
    if (typeof b === 'number' && typeof e === 'number' && e < b) {
      errors.push({
        code: 'BASELINE_TOTALS_NOT_MONOTONIC',
        message: `cumulative ${k} decreased vs baseline`,
      });
    }
  }
  return errors;
}

export function writeProviderBaseline(outPath, baseline, { overwrite = false } = {}) {
  const text = `${JSON.stringify(baseline, null, 2)}\n`;
  writeSecureFile(outPath, text, { mode: 0o600, overwrite });
}
