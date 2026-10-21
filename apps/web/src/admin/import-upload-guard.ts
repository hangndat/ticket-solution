import { IMPORT_LIMITS } from '@ticket/contracts';

/** Room for multipart fields before the file part is parsed. */
export const IMPORT_UPLOAD_MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/** Whole multipart body cap (file + fields + boundaries). */
export function importUploadBodyLimitBytes(
  maxFileBytes = IMPORT_LIMITS.maxBytes,
): number {
  return maxFileBytes + IMPORT_UPLOAD_MULTIPART_OVERHEAD_BYTES;
}

export class ImportUploadBodyTooLargeError extends Error {
  override readonly name = 'ImportUploadBodyTooLargeError';
}

export function isImportUploadBodyTooLargeError(
  error: unknown,
): error is ImportUploadBodyTooLargeError {
  return error instanceof ImportUploadBodyTooLargeError;
}

async function readRequestBodyUpTo(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<{ kind: 'ok'; bytes: Uint8Array } | { kind: 'too-large' }> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        return { kind: 'too-large' };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { kind: 'ok', bytes: out };
}

/**
 * Parse multipart import upload with a streaming byte cap (chunked bodies without
 * Content-Length). Still enforces per-file size after parse.
 */
export async function readBoundedImportUploadFormData(
  request: Request,
  maxFileBytes = IMPORT_LIMITS.maxBytes,
): Promise<FormData> {
  const limit = importUploadBodyLimitBytes(maxFileBytes);
  const contentLength = request.headers.get('content-length');
  if (
    contentLength != null &&
    contentLength !== '' &&
    !oversizedUploadContentLength(contentLength, maxFileBytes)
  ) {
    return await request.formData();
  }

  const body = request.body;
  if (!body) {
    return await request.formData();
  }

  const buffered = await readRequestBodyUpTo(body, limit);
  if (buffered.kind === 'too-large') {
    throw new ImportUploadBodyTooLargeError();
  }

  const contentType = request.headers.get('content-type');
  if (!contentType?.toLowerCase().includes('multipart/form-data')) {
    throw new TypeError('Expected multipart form data');
  }

  const bodyBytes = buffered.bytes.slice();
  return await new Response(new Blob([bodyBytes]), {
    headers: { 'Content-Type': contentType },
  }).formData();
}

export function oversizedUploadContentLength(
  contentLengthHeader: string | null,
  maxFileBytes = IMPORT_LIMITS.maxBytes,
): boolean {
  if (contentLengthHeader == null || contentLengthHeader === '') return false;
  const n = Number.parseInt(contentLengthHeader, 10);
  if (!Number.isFinite(n) || n < 0) return true;
  return n > maxFileBytes + IMPORT_UPLOAD_MULTIPART_OVERHEAD_BYTES;
}

const CSV_MIME = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
]);

/** Require .csv extension or an explicit CSV MIME — not generic text/*. */
export function isAcceptedImportCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return true;
  const type = file.type.toLowerCase().split(';')[0]!.trim();
  if (!type) return false;
  if (CSV_MIME.has(type)) return true;
  return type.includes('csv');
}
