/**
 * CSV cell escaping with formula-injection guard (PRD M11 / TD).
 * Prefix leading whitespace/tab/CR and =+-@ with a single quote.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const needsFormulaGuard = /^[\s\t\r\n]*[=+\-@]/.test(raw);
  const guarded = needsFormulaGuard ? `'${raw}` : raw;
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

export function toCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(escapeCsvCell).join(',');
}
