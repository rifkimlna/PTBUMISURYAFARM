// Export Laporan Buku Besar (mandiri — tidak mengubah builder lain).
// PDF tabel Tanggal|Transaksi|Nomor|Keterangan|Debit|Kredit|Saldo per akun +
// XLSX 9 kolom, memakai snapshot API yang sama dengan tampilan web.

import type { BukuBesarSnapshot } from "@/lib/buku-besar-types";

export const BUKU_BESAR_PERUSAHAAN = "PT BUMI SURYA FARM";

/** Format IDR akuntansi: negatif dalam kurung, ex: "Rp 1.000.000" / "(Rp 250.000)". */
export function formatIDREkspor(n: number): string {
  const v = Math.round(Number(n) || 0);
  const abs = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return v < 0 ? `(Rp ${abs})` : `Rp ${abs}`;
}

function fmtTglPendek(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ---------------------------------------------------------------------------
// PDF (PDF 1.4, font base-14)
// ---------------------------------------------------------------------------

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 36;

const X_TGL = MARGIN;
const X_TRANSAKSI = 78;
const X_NOMOR = 168;
const X_KET = 228;
const X_DEB_R = 378;
const X_KRED_R = 468;
const X_SALDO_R = PAGE_W - MARGIN;

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
    "−": "-", "→": "->",
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
  | { kind: "akun"; text: string }
  | { kind: "head" }
  | { kind: "row"; tgl: string; transaksi: string[]; nomor: string; keterangan: string[]; debit: string; kredit: string; saldo: string; bold: boolean };

function snapshotKeLines(s: BukuBesarSnapshot): PdfLine[] {
  const lines: PdfLine[] = [
    { kind: "center", text: BUKU_BESAR_PERUSAHAAN, size: 12, bold: true },
    { kind: "center", text: "Buku Besar", size: 12, bold: true },
    { kind: "center", text: s.label, size: 9.5, bold: true },
    { kind: "center", text: "(dalam IDR)", size: 9.5, bold: true },
    { kind: "left", text: "", size: 9, bold: false },
  ];
  if (s.akun.length === 0) {
    lines.push({ kind: "left", text: "Tidak ada mutasi pada periode ini.", size: 9, bold: false });
  }
  for (const a of s.akun) {
    lines.push({ kind: "akun", text: `${a.kode} - ${a.nama}` });
    lines.push({ kind: "head" });
    lines.push({
      kind: "row", tgl: "", transaksi: ["Saldo awal"], nomor: "", keterangan: [""],
      debit: "", kredit: "", saldo: formatIDREkspor(a.saldoAwal), bold: false,
    });
    for (const b of a.baris) {
      lines.push({
        kind: "row",
        tgl: fmtTglPendek(b.tanggal),
        transaksi: bungkusKata(b.transaksi || b.uraian, 16),
        nomor: b.noTransaksi ?? "-",
        keterangan: bungkusKata(b.keterangan || "-", 16),
        debit: b.debit !== 0 ? formatIDREkspor(b.debit) : "-",
        kredit: b.kredit !== 0 ? formatIDREkspor(b.kredit) : "-",
        saldo: formatIDREkspor(b.saldo),
        bold: false,
      });
    }
    lines.push({
      kind: "row", tgl: "", transaksi: [`Total mutasi ${a.kode}`], nomor: "", keterangan: [""],
      debit: formatIDREkspor(a.totalDebit), kredit: formatIDREkspor(a.totalKredit), saldo: "-", bold: true,
    });
    lines.push({
      kind: "row", tgl: "", transaksi: [`Current Balance ${a.kode}`], nomor: "", keterangan: [""],
      debit: "-", kredit: "-", saldo: formatIDREkspor(a.saldoAkhir), bold: true,
    });
    lines.push({ kind: "left", text: "", size: 9, bold: false });
  }
  const grandSaldo = s.akun.reduce((acc, a) => acc + Math.round(Number(a.saldoAkhir) || 0), 0);
  lines.push({
    kind: "row", tgl: "", transaksi: ["Grand Total"], nomor: "", keterangan: [""],
    debit: formatIDREkspor(Math.round(Number(s.totalDebit) || 0)),
    kredit: formatIDREkspor(Math.round(Number(s.totalKredit) || 0)),
    saldo: formatIDREkspor(grandSaldo), bold: true,
  });
  lines.push({ kind: "left", text: "Catatan:", size: 8, bold: true });
  for (const c of s.catatan) {
    for (const w of bungkusKata(`- ${c}`, 100)) {
      lines.push({ kind: "left", text: w, size: 7.5, bold: false, indent: 12 });
    }
  }
  return lines;
}

export function buildBukuBesarPdf(snapshots: BukuBesarSnapshot[]): Buffer {
  // Pecah baris multi-uraian menjadi baris fisik per halaman.
  const pages: { line: PdfLine; yTop: number }[][] = [];
  let cur: { line: PdfLine; yTop: number }[] = [];
  let y = PAGE_H - MARGIN;
  const need = (l: PdfLine): number => {
    if (l.kind === "row") {
      const n = Math.max(l.transaksi.length, l.keterangan.length, 1);
      if (n > 1) return n * 8 * 1.5;
    }
    if (l.kind === "akun") return 15;
    if (l.kind === "head") return 13;
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
      } else if (line.kind === "akun") {
        stream += draw(line.text, 9.5, true, MARGIN, yTop - 11.5);
      } else if (line.kind === "head") {
        const base = yTop - 10;
        stream += draw("Tanggal", 7, true, X_TGL, base);
        stream += draw("Transaksi", 7, true, X_TRANSAKSI, base);
        stream += draw("Nomor", 7, true, X_NOMOR, base);
        stream += draw("Keterangan", 7, true, X_KET, base);
        stream += drawRight("Debit", 7, true, X_DEB_R, base);
        stream += drawRight("Kredit", 7, true, X_KRED_R, base);
        stream += drawRight("Saldo", 7, true, X_SALDO_R, base);
      } else {
        const size = 7;
        const step = size * 1.5;
        const nLines = Math.max(line.transaksi.length, line.keterangan.length, 1);
        for (let li = 0; li < nLines; li++) {
          const base = yTop - size - 2 - li * step;
          if (li === 0) {
            if (line.tgl) stream += draw(line.tgl, size, line.bold, X_TGL, base);
            if (line.nomor) stream += draw(line.nomor, 6.5, line.bold, X_NOMOR, base);
            stream += drawRight(line.debit, size, line.bold, X_DEB_R, base);
            stream += drawRight(line.kredit, size, line.bold, X_KRED_R, base);
            stream += drawRight(line.saldo, size, line.bold, X_SALDO_R, base);
          }
          const tTx = line.transaksi[li] ?? "";
          const tKet = line.keterangan[li] ?? "";
          if (tTx) stream += draw(tTx, size, line.bold, X_TRANSAKSI, base);
          if (tKet) stream += draw(tKet, size, line.bold, X_KET, base);
        }
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

export function snapshotKeSheet(s: BukuBesarSnapshot, sheetName: string): XlsxSheet {
  const rows: XlsxCell[][] = [
    [{ v: BUKU_BESAR_PERUSAHAAN, bold: true }],
    [{ v: "Buku Besar", bold: true }],
    [{ v: s.label }],
    [{ v: "(dalam IDR)" }],
    [],
    [
      { v: "Kode", bold: true },
      { v: "Nama Akun", bold: true },
      { v: "Tanggal", bold: true },
      { v: "Transaksi", bold: true },
      { v: "Nomor", bold: true },
      { v: "Keterangan", bold: true },
      { v: "Debit", bold: true },
      { v: "Kredit", bold: true },
      { v: "Saldo", bold: true },
    ],
  ];
  for (const a of s.akun) {
    rows.push([{ v: `${a.kode} - ${a.nama}`, bold: true }]);
    rows.push([
      { v: a.kode }, { v: a.nama }, { v: "" }, { v: "Saldo awal" },
      { v: "" }, { v: "" },
      { v: "" }, { v: "" }, { v: Math.round(a.saldoAwal), num: true },
    ]);
    for (const b of a.baris) {
      rows.push([
        { v: a.kode },
        { v: a.nama },
        { v: fmtTglPendek(b.tanggal) },
        { v: b.transaksi || b.uraian },
        { v: b.noTransaksi ?? "-" },
        { v: b.keterangan ?? "-" },
        { v: Math.round(b.debit), num: true },
        { v: Math.round(b.kredit), num: true },
        { v: Math.round(b.saldo), num: true },
      ]);
    }
    rows.push([
      { v: `Total mutasi ${a.kode}`, bold: true }, { v: "", bold: true }, { v: "", bold: true },
      { v: "", bold: true }, { v: "", bold: true }, { v: "", bold: true },
      { v: Math.round(a.totalDebit), bold: true, num: true },
      { v: Math.round(a.totalKredit), bold: true, num: true },
      { v: "", bold: true },
    ]);
    rows.push([
      { v: `Current Balance ${a.kode} - ${a.nama}`, bold: true }, { v: "", bold: true }, { v: "", bold: true },
      { v: "", bold: true }, { v: "", bold: true }, { v: "", bold: true },
      { v: "", bold: true }, { v: "", bold: true },
      { v: Math.round(a.saldoAkhir), bold: true, num: true },
    ]);
    rows.push([]);
  }
  const grandSaldo = s.akun.reduce((acc, a) => acc + Math.round(Number(a.saldoAkhir) || 0), 0);
  rows.push([
    { v: "Grand Total", bold: true }, { v: "", bold: true }, { v: "", bold: true },
    { v: "", bold: true }, { v: "", bold: true }, { v: "", bold: true },
    { v: Math.round(Number(s.totalDebit) || 0), bold: true, num: true },
    { v: Math.round(Number(s.totalKredit) || 0), bold: true, num: true },
    { v: grandSaldo, bold: true, num: true },
  ]);
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
  const widths = [10, 28, 12, 30, 18, 34, 16, 16, 16]
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

/** Nama file unduhan, ex: Buku_Besar_PT_Bumi_Surya_Farm_2026-09-30.pdf */
export function bukuBesarNamaFile(ext: "pdf" | "xlsx", endIso: string, akun?: string): string {
  const d = new Date(endIso);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  const suffix = akun && akun !== "semua" ? `_${akun}` : "";
  return `Buku_Besar_PT_Bumi_Surya_Farm${suffix}_${ymd}.${ext}`;
}
