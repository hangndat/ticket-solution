import { IMPORT_LIMITS } from '@ticket/contracts';

/** Room for multipart fields before the file part is parsed. */
export const IMPORT_UPLOAD_MULTIPART_OVERHEAD_BYTES = 64 * 1024;

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
