// Export Laporan Neraca Saldo (mandiri — tidak mengubah builder lain).
// PDF landscape tabel Daftar Akun | Saldo Awal (D|K) | Pergerakan (D|K) |
// Saldo Akhir (D|K) + XLSX, memakai snapshot API yang sama dengan tampilan web.

import type { NeracaSaldoSnapshot } from "@/lib/neraca-saldo-types";

export const NERACA_SALDO_PERUSAHAAN = "PT BUMI SURYA FARM";

/** Format IDR akuntansi: negatif dalam kurung, ex: "Rp 1.000.000" / "(Rp 250.000)". */
export function formatIDREkspor(n: number): string {
  const v = Math.round(Number(n) || 0);
  const abs = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return v < 0 ? `(Rp ${abs})` : `Rp ${abs}`;
}

// ---------------------------------------------------------------------------
// PDF (PDF 1.4, landscape A4, font base-14)
// ---------------------------------------------------------------------------

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 36;

const X_AKUN = MARGIN;
const X_AD_R = 316;
const X_AK_R = 396;
const X_GD_R = 506;
const X_GK_R = 586;
const X_ED_R = 706;
const X_EK_R = PAGE_W - MARGIN;

const HELV_W: Record<string, number> = {
  " ": 278, "(": 333, ")": 333, ",": 333, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
  "8": 556, "9": 556, R: 722, p: 556,
};

function lebarTeks(t: string, size: number): number {
  let w = 0;
  for (const ch of t) w += HELV_W[ch] ?? 550;
  return (w / 1000) * size;
}

function sanitasiPdf(t: string): string {
  const map: Record<string, string> = {
    "–": "-", "—": "-", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...",
    "−": "-",
  };
  let out = "";
  for (const ch of t) {
    if (map[ch]) out += map[ch];
    else if (ch.charCodeAt(0) <= 255 && ch !== "\n" && ch !== "\r") out += ch;
  }
  return out;
}

function escapePdf(t: string): string {
  return t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function bungkusKata(t: string, maxChars: number): string[] {
  const words = t.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cand;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

type PdfLine =
  | { kind: "center"; text: string; size: number; bold: boolean }
  | { kind: "left"; text: string; size: number; bold: boolean; indent?: number }
  | { kind: "head" }
  | { kind: "grup"; text: string }
  | { kind: "row"; akun: string[]; ad: string; ak: string; gd: string; gk: string; ed: string; ek: string; bold: boolean };

function snapshotKeLines(s: NeracaSaldoSnapshot): PdfLine[] {
  const lines: PdfLine[] = [
    { kind: "center", text: NERACA_SALDO_PERUSAHAAN, size: 12, bold: true },
    { kind: "center", text: "Neraca Saldo", size: 12, bold: true },
    { kind: "center", text: s.label, size: 9.5, bold: true },
    { kind: "center", text: "(dalam IDR)", size: 9.5, bold: true },
    { kind: "left", text: "", size: 9, bold: false },
    { kind: "head" },
  ];
  if (s.baris.length === 0) {
    lines.push({ kind: "left", text: "Tidak ada mutasi pada periode ini.", size: 9, bold: false });
  }
  for (const g of s.grup) {
    lines.push({ kind: "grup", text: g.nama.toUpperCase() });
    for (const b of g.baris) {
      lines.push({
        kind: "row", akun: bungkusKata(`${b.kode} - ${b.nama}`, 34),
        ad: formatIDREkspor(b.saldoAwalDebit), ak: formatIDREkspor(b.saldoAwalKredit),
        gd: formatIDREkspor(b.debit), gk: formatIDREkspor(b.kredit),
        ed: formatIDREkspor(b.akhirDebit), ek: formatIDREkspor(b.akhirKredit), bold: false,
      });
    }
    lines.push({
      kind: "row", akun: [`Total ${g.nama}`],
      ad: formatIDREkspor(g.totalAwalDebit), ak: formatIDREkspor(g.totalAwalKredit),
      gd: formatIDREkspor(g.totalDebit), gk: formatIDREkspor(g.totalKredit),
      ed: formatIDREkspor(g.totalAkhirDebit), ek: formatIDREkspor(g.totalAkhirKredit), bold: true,
    });
  }
  lines.push({
    kind: "row", akun: ["TOTAL"],
    ad: formatIDREkspor(s.totalAwalDebit), ak: formatIDREkspor(s.totalAwalKredit),
    gd: formatIDREkspor(s.totalDebit), gk: formatIDREkspor(s.totalKredit),
    ed: formatIDREkspor(s.totalAkhirDebit), ek: formatIDREkspor(s.totalAkhirKredit), bold: true,
  });
  lines.push({
    kind: "left",
    text: s.seimbang
      ? "Seimbang: Debit = Kredit (saldo awal, pergerakan, saldo akhir)"
      : "Selisih: debit tidak sama dengan kredit — periksa data",
    size: 9, bold: true,
  });
  lines.push({ kind: "left", text: "", size: 9, bold: false });
  lines.push({ kind: "left", text: "Catatan:", size: 8, bold: true });
  for (const c of s.catatan) {
    for (const w of bungkusKata(`- ${c}`, 100)) {
      lines.push({ kind: "left", text: w, size: 7.5, bold: false, indent: 12 });
    }
  }
  return lines;
}

export function buildNeracaSaldoPdf(snapshots: NeracaSaldoSnapshot[]): Buffer {
  const pages: { line: PdfLine; yTop: number }[][] = [];
  let cur: { line: PdfLine; yTop: number }[] = [];
  let y = PAGE_H - MARGIN;
  const need = (l: PdfLine): number => {
    if (l.kind === "row" && l.akun.length > 1) return l.akun.length * 8 * 1.5;
    if (l.kind === "grup") return 14;
    if (l.kind === "head") return 26;
    if (l.kind === "center") return l.size * 1.5;
    return (l as { size: number }).size * 1.5;
  };
  const push = (line: PdfLine) => {
    const h = need(line) || 12;
    if (y - h < MARGIN) {
      pages.push(cur);
      cur = [];
      y = PAGE_H - MARGIN;
    }
    cur.push({ line, yTop: y });
    y -= h;
  };
  snapshots.forEach((s, si) => {
    for (const l of snapshotKeLines(s)) push(l);
    if (si !== snapshots.length - 1) {
      pages.push(cur);
      cur = [];
      y = PAGE_H - MARGIN;
    }
  });
  if (cur.length) pages.push(cur);
  if (pages.length === 0) pages.push([]);

  const offsets: number[] = [];
  let pos = 0;
  const header = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1");
  const parts: Buffer[] = [header];
  pos = header.length;
  const emit = (body: string | Buffer) => {
    const b = typeof body === "string" ? Buffer.from(body, "latin1") : body;
    offsets.push(pos);
    parts.push(b);
    pos += b.length;
  };

  const n = pages.length;
  const fontReg = 3;
  const fontBold = 4;
  const firstPageObj = 5;
  const kids = Array.from({ length: n }, (_, i) => `${firstPageObj + i * 2} 0 R`).join(" ");
  const ordered: { num: number; body: string | Buffer }[] = [
    { num: 1, body: `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` },
    { num: 2, body: `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n` },
    { num: fontReg, body: `${fontReg} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n` },
    { num: fontBold, body: `${fontBold} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n` },
  ];

  const draw = (t: string, size: number, bold: boolean, x: number, baseline: number) =>
    `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${baseline.toFixed(1)} Tm (${escapePdf(sanitasiPdf(t))}) Tj ET\n`;
  const drawRight = (t: string, size: number, bold: boolean, rightX: number, baseline: number) =>
    draw(t, size, bold, rightX - lebarTeks(sanitasiPdf(t), size), baseline);

  for (let i = 0; i < n; i++) {
    const pageObj = firstPageObj + i * 2;
    const contentObj = pageObj + 1;
    let stream = "";
    for (const { line, yTop } of pages[i]) {
      if (line.kind === "center") {
        const w = lebarTeks(sanitasiPdf(line.text), line.size);
        stream += draw(line.text, line.size, line.bold, (PAGE_W - w) / 2, yTop - line.size - 2);
      } else if (line.kind === "left") {
        if (line.text) stream += draw(line.text, line.size, line.bold, MARGIN + (line.indent ?? 0), yTop - line.size - 2);
      } else if (line.kind === "grup") {
        stream += draw(line.text, 9, true, X_AKUN, yTop - 11.5);
      } else if (line.kind === "head") {
        const top = yTop - 10;
        const bot = yTop - 22;
        stream += draw("Daftar Akun", 7.5, true, X_AKUN, bot);
        stream += draw("Saldo Awal", 7.5, true, (X_AD_R + X_AK_R) / 2 - 22, top);
        stream += draw("Pergerakan", 7.5, true, (X_GD_R + X_GK_R) / 2 - 22, top);
        stream += draw("Saldo Akhir", 7.5, true, (X_ED_R + X_EK_R) / 2 - 22, top);
        stream += drawRight("Debit", 7, true, X_AD_R, bot);
        stream += drawRight("Kredit", 7, true, X_AK_R, bot);
        stream += drawRight("Debit", 7, true, X_GD_R, bot);
        stream += drawRight("Kredit", 7, true, X_GK_R, bot);
        stream += drawRight("Debit", 7, true, X_ED_R, bot);
        stream += drawRight("Kredit", 7, true, X_EK_R, bot);
      } else {
        const size = 7.5;
        const step = size * 1.5;
        line.akun.forEach((nm, li) => {
          const base = yTop - size - 2 - li * step;
          if (li === 0) {
            stream += drawRight(line.ad, size, line.bold, X_AD_R, base);
            stream += drawRight(line.ak, size, line.bold, X_AK_R, base);
            stream += drawRight(line.gd, size, line.bold, X_GD_R, base);
            stream += drawRight(line.gk, size, line.bold, X_GK_R, base);
            stream += drawRight(line.ed, size, line.bold, X_ED_R, base);
            stream += drawRight(line.ek, size, line.bold, X_EK_R, base);
          }
          stream += draw(nm, size, line.bold, X_AKUN, base);
        });
      }
    }
    stream += draw(`Halaman ${i + 1} dari ${n}`, 8, false, PAGE_W / 2 - 20, MARGIN - 16);
    const streamBuf = Buffer.from(stream, "latin1");
    ordered.push({
      num: pageObj,
      body:
        `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 ${fontReg} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`,
    });
    ordered.push({
      num: contentObj,
      body: Buffer.concat([
        Buffer.from(`${contentObj} 0 obj\n<< /Length ${streamBuf.length} >>\nstream\n`, "latin1"),
        streamBuf,
        Buffer.from("\nendstream\nendobj\n", "latin1"),
      ]),
    });
  }

  for (const o of ordered) emit(o.body);
  const xrefPos = pos;
  const total = firstPageObj + n * 2;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) xref += `${String(offsets[i - 1]).padStart(10, "0")} 00000 n \n`;
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`, "latin1"));
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// XLSX (OOXML minimal, ZIP stored — kolom dinamis)
// ---------------------------------------------------------------------------

export type XlsxCell = { v: string | number; bold?: boolean; num?: boolean };
export type XlsxSheet = { name: string; rows: XlsxCell[][] };

export function snapshotKeSheet(s: NeracaSaldoSnapshot, sheetName: string): XlsxSheet {
  const rows: XlsxCell[][] = [
    [{ v: NERACA_SALDO_PERUSAHAAN, bold: true }],
    [{ v: "Neraca Saldo", bold: true }],
    [{ v: s.label }],
    [{ v: "(dalam IDR)" }],
    [],
    [
      { v: "Daftar Akun", bold: true },
      { v: "Saldo Awal Debit", bold: true },
      { v: "Saldo Awal Kredit", bold: true },
      { v: "Pergerakan Debit", bold: true },
      { v: "Pergerakan Kredit", bold: true },
      { v: "Saldo Akhir Debit", bold: true },
      { v: "Saldo Akhir Kredit", bold: true },
    ],
  ];
  for (const g of s.grup) {
    rows.push([{ v: g.nama.toUpperCase(), bold: true }]);
    for (const b of g.baris) {
      rows.push([
        { v: `${b.kode} - ${b.nama}` },
        { v: Math.round(b.saldoAwalDebit), num: true },
        { v: Math.round(b.saldoAwalKredit), num: true },
        { v: Math.round(b.debit), num: true },
        { v: Math.round(b.kredit), num: true },
        { v: Math.round(b.akhirDebit), num: true },
        { v: Math.round(b.akhirKredit), num: true },
      ]);
    }
    rows.push([
      { v: `Total ${g.nama}`, bold: true },
      { v: Math.round(g.totalAwalDebit), bold: true, num: true },
      { v: Math.round(g.totalAwalKredit), bold: true, num: true },
      { v: Math.round(g.totalDebit), bold: true, num: true },
      { v: Math.round(g.totalKredit), bold: true, num: true },
      { v: Math.round(g.totalAkhirDebit), bold: true, num: true },
      { v: Math.round(g.totalAkhirKredit), bold: true, num: true },
    ]);
    rows.push([]);
  }
  rows.push([
    { v: "TOTAL", bold: true },
    { v: Math.round(s.totalAwalDebit), bold: true, num: true },
    { v: Math.round(s.totalAwalKredit), bold: true, num: true },
    { v: Math.round(s.totalDebit), bold: true, num: true },
    { v: Math.round(s.totalKredit), bold: true, num: true },
    { v: Math.round(s.totalAkhirDebit), bold: true, num: true },
    { v: Math.round(s.totalAkhirKredit), bold: true, num: true },
  ]);
  rows.push([]);
  rows.push([{ v: s.seimbang ? "Seimbang: Debit = Kredit (awal, gerak, akhir)" : "Selisih: periksa data", bold: true }]);
  rows.push([]);
  rows.push([{ v: "Catatan:", bold: true }]);
  for (const c of s.catatan) rows.push([{ v: `- ${c}` }]);
  return { name: sheetName.slice(0, 31), rows };
}

function escXml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function colName(i: number): string {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function sheetXml(sheet: XlsxSheet): string {
  const nCols = Math.max(...sheet.rows.map((r) => r.length), 1);
  const dims = `A1:${colName(nCols - 1)}${sheet.rows.length}`;
  let rows = "";
  sheet.rows.forEach((r, ri) => {
    let cells = "";
    r.forEach((c, ci) => {
      const ref = `${colName(ci)}${ri + 1}`;
      const style = c.num ? (c.bold ? 2 : 1) : c.bold ? 3 : 0;
      const sAttr = style ? ` s="${style}"` : "";
      if (typeof c.v === "number") {
        cells += `<c r="${ref}"${sAttr}><v>${c.v}</v></c>`;
      } else {
        cells += `<c r="${ref}"${sAttr} t="inlineStr"><is><t>${escXml(c.v)}</t></is></c>`;
      }
    });
    rows += `<row r="${ri + 1}">${cells}</row>`;
  });
  const widths = [34, 18, 18, 18, 18, 18, 18]
    .slice(0, nCols)
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="${dims}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
    `<sheetFormat defaultRowHeight="15"/>` +
    `<cols>${widths}</cols>` +
    `<sheetData>${rows}</sheetData></worksheet>`
  );
}

function crc32(buf: Buffer): number {
  let table = (crc32 as unknown as { t?: number[] }).t;
  if (!table) {
    table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    (crc32 as unknown as { t: number[] }).t = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildXlsx(sheets: XlsxSheet[]): Buffer {
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join("") +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;
  const wbRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join("") +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;
  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${sheets
      .map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets></workbook>`;
  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="1"><numFmt numFmtId="165" formatCode="#,##0"/></numFmts>` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="4">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `</cellXfs></styleSheet>`;

  const files: { name: string; data: Buffer }[] = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rels, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbook, "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(wbRels, "utf8") },
    { name: "xl/styles.xml", data: Buffer.from(styles, "utf8") },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(sheetXml(s), "utf8"),
    })),
  ];

  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, f.data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(f.data.length, 20);
    cen.writeUInt32LE(f.data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + f.data.length;
  }
  const centralStart = offset;
  const centralBuf = Buffer.concat(central);
  chunks.push(centralBuf);
  offset += centralBuf.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  chunks.push(end);
  return Buffer.concat(chunks);
}

/** Nama file unduhan, ex: Neraca_Saldo_PT_Bumi_Surya_Farm_2026-09-30.pdf */
export function neracaSaldoNamaFile(ext: "pdf" | "xlsx", endIso: string): string {
  const d = new Date(endIso);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `Neraca_Saldo_PT_Bumi_Surya_Farm_${ymd}.${ext}`;
}
