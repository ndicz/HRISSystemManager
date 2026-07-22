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

export function unzip(buf: Buffer): Record<string, string> {
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

// XML text content escapes &, <, >, ", ' and can carry numeric character
// references (e.g. &#xA; for a literal newline in a rich-text cell, common
// when a fingerprint export wraps an overnight checkout onto a second line
// like "06:33\n(1 Jul 2026)"). Left undecoded, that entity text leaks
// verbatim into stored check-in/out values instead of a real newline.
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, "&");
}

export function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const siBlocks = xml.split("<si>").slice(1).map((b) => b.split("</si>")[0]);
  return siBlocks.map((b) => decodeXmlEntities([...b.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("")));
}

export function parseSheetRows(xml: string, strs: string[]): Record<string, string>[] {
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
      rowObj[col] = typeMatch?.[1] === "s" ? strs[parseInt(val, 10)] : decodeXmlEntities(val);
    }
    rows.push(rowObj);
  }
  return rows;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3));
// Some exports (e.g. the Indonesian-language "Laporan Kehadiran Harian"
// vertical format) render dates as "8 Juni 2026" instead of "8 June 2026".
const MONTHS_ID = [
  "januari", "februari", "maret", "april", "mei", "juni",
  "juli", "agustus", "september", "oktober", "november", "desember",
];

function monthIndexFromName(name: string): number {
  const lower = name.toLowerCase();
  const full = MONTHS.indexOf(lower);
  if (full !== -1) return full;
  const idFull = MONTHS_ID.indexOf(lower);
  if (idFull !== -1) return idFull;
  return MONTH_ABBR.indexOf(lower.slice(0, 3));
}

function parseEnglishDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const monthIdx = monthIndexFromName(m[2]);
  if (monthIdx === -1) return null;
  return new Date(parseInt(m[3], 10), monthIdx, parseInt(m[1], 10));
}

function parsePeriodRange(period: string): { start: Date; end: Date } | null {
  const m = period.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const startMonth = monthIndexFromName(m[2]);
  const endMonth = monthIndexFromName(m[5]);
  if (startMonth === -1 || endMonth === -1) return null;
  return {
    start: new Date(parseInt(m[3], 10), startMonth, parseInt(m[1], 10)),
    end: new Date(parseInt(m[6], 10), endMonth, parseInt(m[4], 10)),
  };
}

// "Ringkasan Kehadiran"-style exports only give monthly totals per
// employee, no per-day punches — but the rest of the app (month-scoped
// payroll, the daily recap table) is built around individual
// AttendanceRecord dates. We reconstruct a plausible day-by-day
// breakdown by walking the stated period, treating weekends as "Hari
// Libur" and assigning the reported hadir/sakit/alpha counts to
// weekdays in order. Which *specific* weekday got which status is a
// guess — the totals are what's authoritative — so HR can still
// correct individual days afterward via the existing per-day editor.
function distributeMonthlyStatuses(
  period: { start: Date; end: Date },
  hadir: number,
  sakit: number,
  alpha: number,
): AttendanceImportDay[] {
  const days: AttendanceImportDay[] = [];
  for (const cur = new Date(period.start); cur <= period.end; cur.setDate(cur.getDate() + 1)) {
    const dow = cur.getDay();
    days.push({ date: new Date(cur), status: dow === 0 || dow === 6 ? "Hari Libur" : "", lateMin: 0 });
  }

  // Fill weekdays first (in order), then — if the reported totals exceed
  // the number of weekdays available (e.g. a 6-day work week) — spill the
  // remainder into the "Hari Libur" days so the totals always match the
  // source exactly; which day loses its "Libur" tag is a guess either way.
  const remaining = { hadir, sakit, alpha };
  for (const pass of [days.filter((d) => d.status === ""), days.filter((d) => d.status === "Hari Libur")]) {
    for (const day of pass) {
      if (remaining.hadir > 0) {
        day.status = "Hadir";
        remaining.hadir--;
      } else if (remaining.sakit > 0) {
        day.status = "Izin";
        remaining.sakit--;
      } else if (remaining.alpha > 0) {
        day.status = "Alpha";
        remaining.alpha--;
      } else if (day.status === "") {
        day.status = "Hari Libur";
      }
    }
  }
  return days;
}

// Canonical status vocabulary used by AttendanceRecord.status in the app,
// mapped from whatever label the fingerprint export uses (English or the
// Indonesian-language "Laporan Kehadiran Harian" variant).
function mapStatus(raw: string): string {
  if (raw === "Present at Workday" || raw === "Hadir di Hari Kerja" || raw === "Hadir Bukan Hari Kerja") return "Hadir";
  if (raw === "Sick Leave" || raw === "Sakit" || raw === "Izin") return "Izin";
  if (raw === "Non-working Day" || raw === "Bukan Hari Kerja") return "Hari Libur";
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
  const starts = [...groupStarts];
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

// Tries each (group, label) pair in order — used to match both the
// English column labels and their Indonesian-language equivalents.
function findDetailColAny(
  headerMap: Record<string, string>,
  groupMap: Record<string, string>,
  candidates: [group: string, label: string][],
): string | undefined {
  for (const [group, label] of candidates) {
    const col = findDetailCol(headerMap, groupMap, group, label);
    if (col) return col;
  }
  return undefined;
}

export type AttendanceImportDay = {
  date: Date;
  status: string;
  checkIn?: string;
  checkOut?: string;
  location?: string;
  scheduledCheckIn?: string;
  scheduledCheckOut?: string;
  lateMin: number;
};

// A punch time cell can wrap onto a second line for an overnight shift
// (e.g. "06:33\n(1 Jul 2026)" once XML entities are decoded) — only the
// first line is the actual clock time.
function firstLine(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const line = raw.split("\n")[0].trim();
  return line || undefined;
}

function parseTimeToMinutes(raw: string | undefined): number | null {
  const m = raw?.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  return h * 60 + mm;
}

// Some exports report lateness directly as its own column instead of (or
// alongside) separate scheduled/actual clock times — as an "HH:MM:SS" or
// "HH:MM" duration, or a plain number of minutes. When present, this is
// authoritative straight from the source system and preferred over
// deriving lateness ourselves from scheduled vs. actual clock-in.
function parseLateDuration(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return null;
  const hms = trimmed.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (hms) return parseInt(hms[1], 10) * 60 + parseInt(hms[2], 10);
  const plain = trimmed.match(/^(\d+)$/);
  if (plain) return parseInt(plain[1], 10);
  return null;
}

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

// Monthly-summary export ("Ringkasan Kehadiran") — one row per employee
// with totals (Hari kehadiran, Sakit, Tidak hadir, ...), no per-day
// punches. Detected by its Indonesian header labels, distinct from the
// vertical per-day English-language format handled by parseVerticalDaily.
function parseRingkasanKehadiran(rows: Record<string, string>[], periodStr: string | undefined): AttendanceImportRow[] {
  const headerRow = rows.find((row) => {
    const vals = Object.values(row);
    return vals.includes("ID Personalia") && vals.includes("Nama") && vals.includes("Hari kehadiran");
  });
  if (!headerRow) return [];

  const colFor = (label: string) => Object.keys(headerRow).find((c) => headerRow[c] === label);
  const codeCol = colFor("ID Personalia");
  const nameCol = colFor("Nama");
  const hadirCol = colFor("Hari kehadiran");
  const sakitCol = colFor("Sakit");
  const izinCol = colFor("Izin Lainnya");
  const cutiTahunanCol = colFor("Cuti Tahunan");
  const cutiSetengahCol = colFor("Cuti Setengah Hari");
  const cutiTakDibayarCol = colFor("Cuti tidak dibayar");
  const alphaCol = colFor("Tidak hadir");
  if (!codeCol || !nameCol) return [];

  const period = periodStr ? parsePeriodRange(periodStr) : null;
  const num = (row: Record<string, string>, col: string | undefined) => {
    const raw = col ? row[col] : undefined;
    const n = raw === undefined ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const headerIndex = rows.indexOf(headerRow);
  return rows
    .slice(headerIndex + 1)
    .filter((row) => row[codeCol] !== undefined && row[nameCol] !== undefined && row[nameCol].trim() !== "")
    .map((row) => {
      const hadir = num(row, hadirCol);
      const sakit = num(row, sakitCol) + num(row, izinCol) + num(row, cutiTahunanCol) + num(row, cutiSetengahCol) + num(row, cutiTakDibayarCol);
      const alpha = num(row, alphaCol);
      return {
        code: row[codeCol].trim(),
        name: row[nameCol].trim(),
        hadir,
        sakit,
        alpha,
        libur: 0,
        lainnya: 0,
        days: period ? distributeMonthlyStatuses(period, hadir, sakit, alpha) : [],
      };
    });
}

function parseVerticalDaily(rows: Record<string, string>[]): AttendanceImportRow[] {
  let headerMap: Record<string, string> | null = null;
  let cols: {
    date?: string;
    status?: string;
    checkIn?: string;
    checkOut?: string;
    location?: string;
    scheduledIn?: string;
    scheduledOut?: string;
    late?: string;
  } = {};
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

    const isHeaderRow = (vals.includes("Date") || vals.includes("Tanggal")) && vals.includes("Status");
    if (isHeaderRow) {
      headerMap = {};
      for (const col in row) {
        if (row[col] !== undefined) headerMap[col] = row[col];
      }

      const dateCol = Object.keys(headerMap).find((c) => headerMap![c] === "Date" || headerMap![c] === "Tanggal");
      const statusCol = Object.keys(headerMap).find((c) => headerMap![c] === "Status");
      const groupMap = prevRow ? resolveGroupMap(prevRow, Object.keys(headerMap)) : {};
      const checkInCol = findDetailColAny(headerMap, groupMap, [
        ["Daily Attendance", "Clock In"],
        ["Kehadiran Harian", "Jam Masuk"],
      ]);
      const checkOutCol = findDetailColAny(headerMap, groupMap, [
        ["Daily Attendance", "Clock Out"],
        ["Kehadiran Harian", "Jam Keluar"],
      ]);
      const locationCol = findDetailColAny(headerMap, groupMap, [
        ["Location", "Clock In"],
        ["Lokasi", "Jam Masuk"],
      ]);
      // "Work Pattern" / "Pola Kerja" is the scheduled shift — the *should
      // have* clocked in/out times — separate from "Daily Attendance" /
      // "Kehadiran Harian", which is the actual punch. Comparing the two is
      // what lets us compute how late someone actually was.
      const scheduledInCol = findDetailColAny(headerMap, groupMap, [
        ["Work Pattern", "Clock In"],
        ["Pola Kerja", "Jam Masuk"],
      ]);
      const scheduledOutCol = findDetailColAny(headerMap, groupMap, [
        ["Work Pattern", "Clock Out"],
        ["Pola Kerja", "Jam Keluar"],
      ]);
      // A handful of exports report lateness as its own explicit column —
      // either grouped under "Daily Attendance"/"Kehadiran Harian" next to
      // Clock In/Out, or as a plain top-level column with no group at all
      // (same shape as Date/Status above). Try both.
      const lateCol =
        findDetailColAny(headerMap, groupMap, [
          ["Daily Attendance", "Late"],
          ["Kehadiran Harian", "Terlambat"],
        ]) ??
        Object.keys(headerMap).find((c) => ["Late", "Terlambat", "Telat", "Late Duration", "Lama Keterlambatan"].includes(headerMap![c]));

      cols = {
        date: dateCol,
        status: statusCol,
        checkIn: checkInCol,
        checkOut: checkOutCol,
        location: locationCol,
        scheduledIn: scheduledInCol,
        scheduledOut: scheduledOutCol,
        late: lateCol,
      };
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
      const checkIn = firstLine(cols.checkIn ? row[cols.checkIn] : undefined);
      const checkOut = firstLine(cols.checkOut ? row[cols.checkOut] : undefined);
      const location = cols.location ? row[cols.location] : undefined;
      const scheduledCheckIn = firstLine(cols.scheduledIn ? row[cols.scheduledIn] : undefined);
      const scheduledCheckOut = firstLine(cols.scheduledOut ? row[cols.scheduledOut] : undefined);
      const lateRaw = cols.late ? row[cols.late] : undefined;

      if (status === "Present at Workday" || status === "Hadir di Hari Kerja" || status === "Hadir Bukan Hari Kerja") current.hadir++;
      else if (status === "Sick Leave" || status === "Sakit" || status === "Izin") current.sakit++;
      else if (status === "No Status" || status === "Belum Ada Status") current.alpha++;
      else if (status === "Non-working Day" || status === "Bukan Hari Kerja") current.libur++;
      else if (status !== undefined) current.lainnya++;

      if (status !== undefined && dateStr !== undefined) {
        const parsedDate = parseEnglishDate(dateStr);
        if (parsedDate) {
          // Prefer a direct "Late"/"Terlambat" column straight from the
          // source when the export has one — only fall back to deriving
          // it from scheduled-vs-actual clock-in when it doesn't.
          const directLateMin = parseLateDuration(lateRaw);
          const actualMin = parseTimeToMinutes(checkIn);
          const scheduledMin = parseTimeToMinutes(scheduledCheckIn);
          const derivedLateMin = actualMin !== null && scheduledMin !== null && actualMin > scheduledMin ? actualMin - scheduledMin : 0;
          const lateMin = directLateMin ?? derivedLateMin;
          current.days.push({
            date: parsedDate,
            status: mapStatus(status),
            checkIn: checkIn && checkIn !== "-" ? checkIn : undefined,
            checkOut: checkOut && checkOut !== "-" ? checkOut : undefined,
            location: location && location !== "-" ? location : undefined,
            scheduledCheckIn: scheduledCheckIn && scheduledCheckIn !== "-" ? scheduledCheckIn : undefined,
            scheduledCheckOut: scheduledCheckOut && scheduledCheckOut !== "-" ? scheduledCheckOut : undefined,
            lateMin,
          });
        }
      }
    }

    prevRow = row;
  }
  finish();

  return results;
}

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

  const results = parseRingkasanKehadiran(rows, periodMatch);
  const finalResults = results.length > 0 ? results : parseVerticalDaily(rows);

  if (finalResults.length === 0) throw new Error("Tidak ada data personil yang terbaca dari file ini");

  return { summary: { companyName, period: periodMatch || "-", count: finalResults.length }, rows: finalResults };
}
