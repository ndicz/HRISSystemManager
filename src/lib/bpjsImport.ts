import { unzip, parseSharedStrings, parseSheetRows } from "@/lib/attendanceImport";

// Handles two shapes:
//  1. A dedicated flat sheet: just ID + BPJS Kesehatan + BPJS Ketenagakerjaan
//     columns, nothing else.
//  2. The client's real payroll workbook shape: a "Salary <Month> <Year>"
//     sheet with BPJS as two of many columns (No, Nama, ID, Posisi, Upah
//     Bulanan, BPJS Kes, BPJS KT, Potongan..., Total Site, Keterangan),
//     grouped into per-site blocks separated by blank/"TOTAL" rows — and
//     critically, the *same sheet* often has a second "Kondite" (leave
//     recap) table appended below it that reuses the same ID column but
//     different meaning for every other column (same trap that corrupted
//     salary data earlier: that table's own header row reintroduces "ID"
//     in the same column, so we stop parsing at the first repeat of the
//     header's own ID-column value instead of reading past it).
// The sheet isn't necessarily sheet1 — the real file keeps "Data Karyawan"
// as sheet1 and "Salary ..." as a later sheet — so every worksheet in the
// archive is tried until one yields a matching header row.

export type BpjsImportRow = {
  empCode: string;
  name?: string;
  // null = the cell was genuinely blank (no data yet, leave the employee
  // on the auto-calculated formula). A real number — including 0 — is an
  // explicit value from the source and gets written as an override,
  // exactly like typing "0" into the manual edit dialog already does.
  bpjsKesehatan: number | null;
  bpjsKetenagakerjaan: number | null;
};

const CODE_LABELS = ["ID Karyawan", "Kode Karyawan", "empCode", "ID", "Kode"];
const NAME_LABELS = ["Nama", "Nama Karyawan", "Name"];
const KESEHATAN_LABELS = ["BPJS Kesehatan", "BPJS Kes", "Kesehatan"];
const KETENAGAKERJAAN_LABELS = ["BPJS Ketenagakerjaan", "BPJS Ketenagakerjaan (JHT+JP)", "BPJS TK", "BPJS KT", "Ketenagakerjaan"];

function num(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "" || raw.trim() === "-") return null;
  const cleaned = raw.replace(/[^\d-]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

function parseSheet(rows: Record<string, string>[]): BpjsImportRow[] {
  const headerRow = rows.find((row) => {
    const vals = Object.values(row);
    const hasCode = CODE_LABELS.some((l) => vals.includes(l));
    const hasKesehatan = KESEHATAN_LABELS.some((l) => vals.includes(l));
    const hasTk = KETENAGAKERJAAN_LABELS.some((l) => vals.includes(l));
    return hasCode && (hasKesehatan || hasTk);
  });
  if (!headerRow) return [];

  const colFor = (labels: string[]) => Object.keys(headerRow).find((c) => labels.includes(headerRow[c]));
  const codeCol = colFor(CODE_LABELS);
  const nameCol = colFor(NAME_LABELS);
  const kesehatanCol = colFor(KESEHATAN_LABELS);
  const tkCol = colFor(KETENAGAKERJAAN_LABELS);
  if (!codeCol) return [];

  const headerIndex = rows.indexOf(headerRow);
  const headerCodeValue = headerRow[codeCol];

  const result: BpjsImportRow[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const code = row[codeCol];
    // A second table appended below (e.g. "Kondite"/leave recap) reuses
    // this same column for its own header — its header row repeats the
    // exact same label ("ID") we matched on above. Treat that as the end
    // of this table rather than reading its differently-meaning columns
    // as if they were still BPJS figures.
    if (code === headerCodeValue) break;
    if (code === undefined || code.trim() === "" || code.trim() === "-") continue;
    result.push({
      empCode: code.trim(),
      name: nameCol ? row[nameCol]?.trim() : undefined,
      bpjsKesehatan: kesehatanCol ? num(row[kesehatanCol]) : null,
      bpjsKetenagakerjaan: tkCol ? num(row[tkCol]) : null,
    });
  }
  return result;
}

export function parseBpjsXlsx(buf: Buffer): BpjsImportRow[] {
  const files = unzip(buf);
  const strs = parseSharedStrings(files["xl/sharedStrings.xml"]);
  const sheetPaths = Object.keys(files)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort();
  if (sheetPaths.length === 0) throw new Error("Sheet tidak ditemukan");

  for (const path of sheetPaths) {
    const rows = parseSheetRows(files[path], strs);
    const parsed = parseSheet(rows);
    if (parsed.length > 0) return parsed;
  }

  throw new Error("Kolom ID Karyawan / BPJS Kesehatan / BPJS Ketenagakerjaan tidak ditemukan di file ini");
}
