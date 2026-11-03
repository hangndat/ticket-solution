/** CSV file validation and row interpretation for import jobs. No DB or object-store access. */
import {
  IMPORT_LIMITS,
  type FieldValidationError,
  type ImportColumnMapping,
  type ImportKind,
} from '@ticket/contracts';
import { toCsvRow } from './csv-guard';
import { IMPORT_ERROR_CODES, ImportError } from './import-error';

export function assertUtf8Csv(buf: Buffer): string {
  if (buf.length === 0 || buf.length > IMPORT_LIMITS.maxBytes) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      `CSV must be 1..${IMPORT_LIMITS.maxBytes} bytes`,
    );
  }
  // Reject UTF-16 BOM
  if (
    (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) ||
    (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff)
  ) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'UTF-16 is not accepted; use UTF-8 CSV',
    );
  }
  let text: string;
  try {
    text = buf.toString('utf8');
  } catch {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'CSV must be valid UTF-8',
    );
  }
  if (text.includes('\uFFFD')) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'CSV contains invalid UTF-8 sequences',
    );
  }
  return text.replace(/^\uFEFF/, '');
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim().length > 0)) rows.push(row);
  return rows;
}

function defaultMapping(kind: ImportKind): ImportColumnMapping {
  return kind === 'CODES' ? { code: 'code' } : { email: 'email' };
}

export function normalizeMapping(
  kind: ImportKind,
  mapping: ImportColumnMapping | undefined,
): ImportColumnMapping {
  const base = defaultMapping(kind);
  const next: ImportColumnMapping = {
    code: mapping?.code?.trim() || base.code,
    email: mapping?.email?.trim() || base.email,
  };
  if (kind === 'CODES') {
    if (mapping?.email) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
        'CODES imports cannot map email',
      );
    }
    delete next.email;
    if (!next.code) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
        'CODES imports require a code column mapping',
      );
    }
  } else {
    if (mapping?.code) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
        'GUESTS imports cannot map code',
      );
    }
    delete next.code;
    if (!next.email) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
        'GUESTS imports require an email column mapping',
      );
    }
  }
  return next;
}

function headerIndex(headers: string[], name: string | undefined): number {
  if (!name) return -1;
  const target = name.trim().toLowerCase();
  return headers.findIndex((h) => h.trim().toLowerCase() === target);
}

function canonicalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

function maskCodeHint(raw: string): string {
  const t = raw.trim();
  if (t.length <= 2) return '**';
  return `${t.slice(0, 1)}***`;
}

export type ValidParsedRow = { ok: true; line: number; value: string };

type ParseResult = {
  valid: ValidParsedRow[];
  errors: FieldValidationError[];
  errorCsv: string;
};

export function parsePayload(
  kind: ImportKind,
  mapping: ImportColumnMapping,
  text: string,
  maxRows: number,
): ParseResult {
  const grid = parseCsvRows(text);
  if (grid.length < 2) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'CSV must include a header row and at least one data row',
    );
  }
  const headers = grid[0]!.map((h) => h.trim());
  const field = kind === 'CODES' ? 'code' : 'email';
  const colName = kind === 'CODES' ? mapping.code : mapping.email;
  const idx = headerIndex(headers, colName);
  if (idx < 0) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      `Mapped column "${colName}" not found in CSV header`,
    );
  }
  const dataRows = grid.slice(1);
  if (dataRows.length > maxRows) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT,
      `Import exceeds ${maxRows} rows`,
    );
  }
  const valid: ValidParsedRow[] = [];
  const errors: FieldValidationError[] = [];
  const seen = new Set<string>();
  const csvLines = [toCsvRow(['line', 'fieldId', 'code', 'message'])];

  for (let i = 0; i < dataRows.length; i++) {
    const line = i + 2;
    const raw = (dataRows[i]![idx] ?? '').trim();
    const fieldId = `row:${line}:${field}`;
    if (!raw) {
      const err: FieldValidationError = {
        fieldId,
        code: 'EMPTY',
        message: `${field} is required`,
      };
      errors.push(err);
      csvLines.push(toCsvRow([line, fieldId, err.code, err.message]));
      continue;
    }
    if (kind === 'GUESTS') {
      const email = canonicalizeEmail(raw);
      if (!isValidEmail(email)) {
        const err: FieldValidationError = {
          fieldId,
          code: 'EMAIL_INVALID',
          message: 'Email format is invalid',
        };
        errors.push(err);
        csvLines.push(toCsvRow([line, fieldId, err.code, err.message]));
        continue;
      }
      if (seen.has(email)) {
        const err: FieldValidationError = {
          fieldId,
          code: 'DUPLICATE_IN_FILE',
          message: 'Duplicate email in file',
        };
        errors.push(err);
        csvLines.push(toCsvRow([line, fieldId, err.code, err.message]));
        continue;
      }
      seen.add(email);
      valid.push({ ok: true, line, value: email });
      continue;
    }
    const code = raw;
    const key = code.toUpperCase();
    if (seen.has(key)) {
      const err: FieldValidationError = {
        fieldId,
        code: 'DUPLICATE_IN_FILE',
        message: 'Duplicate code in file',
      };
      errors.push(err);
      csvLines.push(
        toCsvRow([
          line,
          fieldId,
          err.code,
          `${err.message} (${maskCodeHint(code)})`,
        ]),
      );
      continue;
    }
    seen.add(key);
    valid.push({ ok: true, line, value: code });
  }

  return {
    valid,
    errors,
    errorCsv: csvLines.join('\n') + '\n',
  };
}
