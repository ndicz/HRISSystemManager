import { inflateRawSync } from "node:zlib";

// Minimal, dependency-free .xlsx reader scoped to exactly what we need:
// the "vertical" per-employee attendance export produced by common
// fingerprint attendance apps. We deliberately avoid pulling in a
// third-party xlsx library (e.g. SheetJS) here — the popular npm
// packages for this carry unpatched high-severity advisories
// (prototype pollution / ReDoS) and this is a file-upload attack
// surface, so a small hand-rolled reader is the safer choice for an
// internal tool. It only reads the ZIP central directory + inflates
// entries + regex-scans the sheet/sharedStrings XML — no external
// input ever reaches an XML parser or object-merge path.

type ZipEntry = { name: string; compMethod: number; compSize: number; localOffset: number };

function unzip(buf: Buffer): Record<string, string> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("Bukan file .xlsx yang valid");

  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdCount = buf.readUInt16LE(eocd + 10);

  let p = cdOffset;
  const entries: ZipEntry[] = [];
  for (let i = 0; i < cdCount; i++) {
    const compMethod = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf-8", p + 46, p + 46 + nameLen);
    entries.push({ name, compMethod, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }

  const files: Record<string, string> = {};
  for (const entry of entries) {
    const lp = entry.localOffset;
    const nameLen = buf.readUInt16LE(lp + 26);
    const extraLen = buf.readUInt16LE(lp + 28);
    const dataStart = lp + 30 + nameLen + extraLen;
    const compData = buf.subarray(dataStart, dataStart + entry.compSize);
    files[entry.name] = entry.compMethod === 0 ? compData.toString("utf-8") : inflateRawSync(compData).toString("utf-8");
  }
  return files;
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const siBlocks = xml.split("<si>").slice(1).map((b) => b.split("</si>")[0]);
  return siBlocks.map((b) => [...b.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
}

function parseSheetRows(xml: string, strs: string[]): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  // Rows and cells with no content are self-closing (<row .../>, <c .../>) in
  // real Excel output, and attribute order (style before/after type) isn't
  // fixed — both are handled explicitly below rather than assumed away.
  const rowMatches = [...xml.matchAll(/<row r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)];
  for (const rm of rowMatches) {
    const content = rm[2] ?? "";
    const cells = [...content.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(?:<v>([\s\S]*?)<\/v>)?<\/c>)/g)];
    const rowObj: Record<string, string> = {};
    for (const c of cells) {
      const col = c[1];
      const attrs = c[2];
      const val = c[3];
      if (val === undefined) continue;
      const typeMatch = attrs.match(/ t="(\w+)"/);
      rowObj[col] = typeMatch?.[1] === "s" ? strs[parseInt(val, 10)] : val;
    }
    rows.push(rowObj);
  }
  return rows;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function parseEnglishDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const monthIdx = MONTHS.indexOf(m[2].toLowerCase());
  if (monthIdx === -1) return null;
  return new Date(parseInt(m[3], 10), monthIdx, parseInt(m[1], 10));
}

// Canonical status vocabulary used by AttendanceRecord.status in the app,
// mapped from whatever label the fingerprint export uses.
function mapStatus(raw: string): string {
  if (raw === "Present at Workday") return "Hadir";
  if (raw === "Sick Leave") return "Izin";
  if (raw === "Non-working Day") return "Hari Libur";
  return "Alpha";
}

function colIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

// The export has a super-header row (e.g. "Work Pattern" / "Daily
// Attendance" / "Location") one row above the actual column-label row,
// and several sub-columns repeat the same label ("Clock In" appears
// under three different groups). Only "Daily Attendance" holds the
// real punch time and "Location" the place name, so we disambiguate
// by resolving each label against the group it falls under.
function resolveGroupMap(groupHeaderRow: Record<string, string>, dataCols: string[]): Record<string, string> {
  const groupStarts = Object.keys(groupHeaderRow)
    .filter((c) => groupHeaderRow[c] !== undefined)
    .sort((a, b) => colIndex(a) - colIndex(b));
  const map: Record<string, string> = {};
  let currentLabel = "";
  let starts = [...groupStarts];
  for (const col of dataCols) {
    while (starts.length > 0 && colIndex(starts[0]) <= colIndex(col)) {
      currentLabel = groupHeaderRow[starts.shift()!];
    }
    map[col] = currentLabel;
  }
  return map;
}

function findDetailCol(
  headerMap: Record<string, string>,
  groupMap: Record<string, string>,
  group: string,
  label: string,
  after?: string,
): string | undefined {
  const candidates = Object.keys(headerMap)
    .filter((c) => groupMap[c] === group && headerMap[c] === label && (!after || colIndex(c) > colIndex(after)))
    .sort((a, b) => colIndex(a) - colIndex(b));
  return candidates[0];
}

export type AttendanceImportDay = { date: Date; status: string; checkIn?: string; checkOut?: string; location?: string };

export type AttendanceImportRow = {
  code: string;
  name: string;
  hadir: number;
  sakit: number;
  alpha: number;
  libur: number;
  lainnya: number;
  days: AttendanceImportDay[];
};

export type AttendanceImportResult = {
  summary: { companyName: string; period: string; count: number };
  rows: AttendanceImportRow[];
};

export function parseAttendanceXlsx(buf: Buffer): AttendanceImportResult {
  const files = unzip(buf);
  const sheetPath = Object.keys(files).find((k) => /xl\/worksheets\/sheet1\.xml/.test(k));
  if (!sheetPath) throw new Error("Sheet absensi tidak ditemukan");

  const strs = parseSharedStrings(files["xl/sharedStrings.xml"]);
  const rows = parseSheetRows(files[sheetPath], strs);

  const companyName = strs.find((s) => /^PT /i.test(s)) || "Perusahaan";
  const periodMatch = strs.find(
    (s) => /\d{4}\s*-\s*\d{1,2}\s*\w+\s*\d{4}/.test(s) || /\d{1,2}\s+\w+\s+\d{4}\s*-\s*\d{1,2}\s+\w+\s+\d{4}/.test(s),
  );

  let headerMap: Record<string, string> | null = null;
  let cols: { date?: string; status?: string; checkIn?: string; checkOut?: string; location?: string } = {};
  let prevRow: Record<string, string> | null = null;
  let current: AttendanceImportRow | null = null;
  const results: AttendanceImportRow[] = [];
  const finish = () => {
    if (current) results.push(current);
    current = null;
  };

  for (const row of rows) {
    const vals = Object.values(row).filter((v) => v !== undefined);
    if (vals.length === 0) continue;

    const isHeaderRow = vals.includes("Date") && vals.includes("Status");
    if (isHeaderRow) {
      headerMap = {};
      for (const col in row) {
        if (row[col] !== undefined) headerMap[col] = row[col];
      }

      const dateCol = Object.keys(headerMap).find((c) => headerMap![c] === "Date");
      const statusCol = Object.keys(headerMap).find((c) => headerMap![c] === "Status");
      const groupMap = prevRow ? resolveGroupMap(prevRow, Object.keys(headerMap)) : {};
      const checkInCol = findDetailCol(headerMap, groupMap, "Daily Attendance", "Clock In");
      const checkOutCol = findDetailCol(headerMap, groupMap, "Daily Attendance", "Clock Out");
      const locationCol = findDetailCol(headerMap, groupMap, "Location", "Clock In");

      cols = { date: dateCol, status: statusCol, checkIn: checkInCol, checkOut: checkOutCol, location: locationCol };
      prevRow = row;
      continue;
    }

    const nameCell = Object.values(row).find((v) => typeof v === "string" && / - /.test(v) && !/^\d/.test(v));
    if (nameCell && Object.keys(row).length <= 3) {
      finish();
      const parts = nameCell.split(" - ");
      current = { code: parts[0].trim(), name: parts.slice(1).join(" - ").trim(), hadir: 0, sakit: 0, alpha: 0, libur: 0, lainnya: 0, days: [] };
      prevRow = row;
      continue;
    }

    if (current && headerMap) {
      const status = cols.status ? row[cols.status] : undefined;
      const dateStr = cols.date ? row[cols.date] : undefined;
      const checkIn = cols.checkIn ? row[cols.checkIn] : undefined;
      const checkOut = cols.checkOut ? row[cols.checkOut] : undefined;
      const location = cols.location ? row[cols.location] : undefined;

      if (status === "Present at Workday") current.hadir++;
      else if (status === "Sick Leave") current.sakit++;
      else if (status === "No Status") current.alpha++;
      else if (status === "Non-working Day") current.libur++;
      else if (status !== undefined) current.lainnya++;

      if (status !== undefined && dateStr !== undefined) {
        const parsedDate = parseEnglishDate(dateStr);
        if (parsedDate) {
          current.days.push({
            date: parsedDate,
            status: mapStatus(status),
            checkIn: checkIn && checkIn !== "-" ? checkIn : undefined,
            checkOut: checkOut && checkOut !== "-" ? checkOut : undefined,
            location: location && location !== "-" ? location : undefined,
          });
        }
      }
    }

    prevRow = row;
  }
  finish();

  if (results.length === 0) throw new Error("Tidak ada data personil yang terbaca dari file ini");

  return { summary: { companyName, period: periodMatch || "-", count: results.length }, rows: results };
}
