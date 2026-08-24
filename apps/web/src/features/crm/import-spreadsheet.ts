import { readSheet } from 'read-excel-file/browser';

export interface ImportedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

type SheetCell = string | number | boolean | Date | null;

function cellText(value: SheetCell | undefined): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/** Convierte la primera hoja de un libro en las mismas filas que ya consume el importador CSV. */
export function sheetRowsToRecords(sheet: SheetCell[][]): ImportedSheet {
  if (!sheet.length) return { headers: [], rows: [] };
  const rawHeaders = sheet[0] ?? [];
  const columns = rawHeaders
    .map((value, index) => ({ index, header: cellText(value) }))
    .filter((column) => column.header.length > 0);
  const headers = columns.map((column) => column.header);
  const rows = sheet.slice(1).map((values) => Object.fromEntries(
    columns.map(({ index, header }) => [header, cellText(values[index])]),
  )).filter((row) => Object.values(row).some(Boolean));
  return { headers, rows };
}

export async function readExcelFile(file: File): Promise<ImportedSheet> {
  const sheet = await readSheet(file, 1);
  return sheetRowsToRecords(sheet as SheetCell[][]);
}
