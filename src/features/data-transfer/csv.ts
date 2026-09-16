/**
 * Minimal RFC 4180 CSV reader/writer.
 *
 * Handles: quoted fields containing commas, quoted newlines, escaped double quotes,
 * CRLF and LF line endings, a leading UTF-8 BOM, and trailing blank lines. Semicolon
 * delimiters (common in European locales) are detected from the header row.
 */

export interface ParsedCsv {
  header: string[];
  rows: string[][];
  delimiter: string;
}

const MAX_CELL_LENGTH = 10_000;

export function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? '';
  let inQuotes = false;
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char in counts) counts[char] = (counts[char] ?? 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : ',';
}

export function parseCsv(input: string, delimiterOverride?: string): ParsedCsv {
  const text = input.replace(/^\uFEFF/, '');
  const delimiter = delimiterOverride ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell.length > MAX_CELL_LENGTH ? cell.slice(0, MAX_CELL_LENGTH) : cell);
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    // Skip rows that are entirely empty (trailing newline, blank separator lines).
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell.length === 0) inQuotes = true;
    else if (char === delimiter) pushCell();
    else if (char === '\r') {
      if (text[i + 1] === '\n') i += 1;
      pushRow();
    } else if (char === '\n') pushRow();
    else cell += char;
  }

  if (cell.length > 0 || row.length > 0) pushRow();

  const header = rows.shift() ?? [];
  return { header: header.map((value) => value.trim()), rows, delimiter };
}

/**
 * Escape a value for CSV output.
 *
 * Beyond RFC 4180 quoting, any value starting with =, +, -, @, tab or CR is prefixed with
 * a single quote. Spreadsheets interpret those as formulas; the prefix neutralises CSV
 * injection when a workout note is opened in Excel, Sheets or Numbers.
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/["\n\r,;]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(header: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  const lines = [header.map(escapeCsvValue).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsvValue).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/** Case/whitespace/punctuation-insensitive header key, used for column auto-mapping. */
export function normaliseHeader(value: string): string {
  return (
    value
      .toLowerCase()
      // Strip diacritics so localised headers ("Übung", "Répétitions") match their aliases.
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\(.*?\)/g, ' ')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_|_$)/g, '')
  );
}
