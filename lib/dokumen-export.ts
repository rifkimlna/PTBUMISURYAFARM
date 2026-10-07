// Builder generik file dokumen laporan (PDF & XLSX murni TypeScript, tanpa dependensi).
// Dipakai bersama oleh export Neraca & Laba Rugi agar halaman web, PDF, dan XLSX
// selalu memakai sumber data yang sama (angka identik).
//
// - PDF: dokumen PDF 1.4 valid, font Helvetica/Helvetica-Bold (base-14, tanpa
//   embed), tabel uraian + nominal rata kanan, paginasi otomatis.
// - XLSX: paket OOXML valid (ZIP metode stored + XML) dengan inline strings,
//   satu sheet per periode.

export const DOKUMEN_PERUSAHAAN = "PT BUMI SURYA FARM";

/** Format IDR akuntansi: negatif dalam kurung, ex: "Rp 1.000.000" / "(Rp 250.000)". */
export function formatIDREkspor(n: number): string {
  const v = Math.round(Number(n) || 0);
  const abs = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return v < 0 ? `(Rp ${abs})` : `Rp ${abs}`;
}

// ---------------------------------------------------------------------------
// Model baris generik (dipakai PDF & XLSX dari snapshot yang sama)
// ---------------------------------------------------------------------------

export type DocBaris =
  | { kind: "header"; text: string }
  | { kind: "sub"; text: string }
  | { kind: "item"; kode: string; nama: string; nilai: number }
  | { kind: "total"; text: string; nilai: number }
  | { kind: "note"; text: string }
  | { kind: "blank" };

// ---------------------------------------------------------------------------
// PDF (PDF 1.4, font base-14)
// ---------------------------------------------------------------------------

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const RIGHT_X = PAGE_W - MARGIN;

// Lebar glif Helvetica per 1000 unit (hanya yang dipakai kolom angka + umum).
const HELV_W: Record<string, number> = {
  " ": 278, "(": 333, ")": 333, ",": 333, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
  "8": 556, "9": 556, R: 722, p: 556,
};
const HELV_B_W: Record<string, number> = {
  " ": 278, "(": 333, ")": 333, ",": 333, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
  "8": 556, "9": 556, R: 722, p: 556,
};

function lebarTeks(t: string, size: number, bold: boolean): number {
  const tab = bold ? HELV_B_W : HELV_W;
  let w = 0;
  for (const ch of t) w += tab[ch] ?? 550;
  return (w / 1000) * size;
}

function sanitasiPdf(t: string): string {
  const map: Record<string, string> = {
    "–": "-", "—": "-", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...",
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

type PdfLine = {
  left: string;
  right?: string;
  size: number;
  bold: boolean;
  center?: boolean;
  indent: number;
};

function barisKePdfLines(baris: DocBaris[]): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const b of baris) {
    if (b.kind === "blank") {
      lines.push({ left: "", size: 9, bold: false, indent: 0 });
    } else if (b.kind === "header") {
      lines.push({ left: b.text, size: 12, bold: true, center: true, indent: 0 });
    } else if (b.kind === "sub") {
      lines.push({ left: b.text, size: 9.5, bold: true, indent: b.text === "(dalam IDR)" ? 0 : 0 });
      if (b.text === "(dalam IDR)") lines[lines.length - 1] = { ...lines[lines.length - 1], center: true };
    } else if (b.kind === "item") {
      const label = `${b.kode} — ${b.nama}`;
      const wrapped = bungkusKata(label, 72);
      wrapped.forEach((w, i) =>
        lines.push({
          left: w,
          right: i === 0 ? formatIDREkspor(b.nilai) : undefined,
          size: 9,
          bold: false,
          indent: 12,
        })
      );
    } else if (b.kind === "total") {
      lines.push({ left: b.text, right: formatIDREkspor(b.nilai), size: 9.5, bold: true, indent: 12 });
    } else if (b.kind === "note") {
      for (const w of bungkusKata(b.text, 105))
        lines.push({ left: w, size: 8, bold: false, indent: 12 });
    }
  }
  return lines;
}

/** Satu dokumen PDF; tiap array baris mulai di halaman baru. */
export function buildDokumenPdf(documents: DocBaris[][]): Buffer {
  const pages: PdfLine[][] = [];
  for (const baris of documents) {
    const lines = barisKePdfLines(baris);
    let cur: PdfLine[] = [];
    let y = PAGE_H - MARGIN;
    const step = (l: PdfLine) => l.size * 1.5;
    for (const l of lines) {
      if (y - step(l) < MARGIN) {
        pages.push(cur);
        cur = [];
        y = PAGE_H - MARGIN;
      }
      cur.push(l);
      y -= step(l);
    }
    if (cur.length) pages.push(cur);
  }
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

  // Nomor objek: 1 catalog, 2 pages, 3.. font, lalu page+content bergantian.
  const n = pages.length;
  const fontReg = 3;
  const fontBold = 4;
  const firstPageObj = 5;
  const kids = Array.from({ length: n }, (_, i) => `${firstPageObj + i * 2} 0 R`).join(" ");

  const catalog = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n`;
  const f1 = `${fontReg} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const f2 = `${fontBold} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  const ordered: { num: number; body: string | Buffer }[] = [
    { num: 1, body: catalog },
    { num: 2, body: pagesObj },
    { num: fontReg, body: f1 },
    { num: fontBold, body: f2 },
  ];
  for (let i = 0; i < n; i++) {
    const pageObj = firstPageObj + i * 2;
    const contentObj = pageObj + 1;
    const lines = pages[i];
    let y = PAGE_H - MARGIN;
    let stream = "";
    for (const l of lines) {
      const step = l.size * 1.5;
      y -= 0; // posisi baseline di y - step + offset
      const baseline = y - 4;
      const font = l.bold ? "F2" : "F1";
      if ("center" in l && l.center) {
        const w = lebarTeks(sanitasiPdf(l.left), l.size, l.bold);
        const x = (PAGE_W - w) / 2;
        stream += `BT /${font} ${l.size} Tf 1 0 0 1 ${x.toFixed(1)} ${baseline.toFixed(1)} Tm (${escapePdf(sanitasiPdf(l.left))}) Tj ET\n`;
      } else if ("right" in l && l.right !== undefined) {
        const w = lebarTeks(l.right, l.size, l.bold);
        const xRight = RIGHT_X - w;
        const xLeft = MARGIN + l.indent;
        stream += `BT /${font} ${l.size} Tf 1 0 0 1 ${xLeft.toFixed(1)} ${baseline.toFixed(1)} Tm (${escapePdf(sanitasiPdf(l.left))}) Tj ET\n`;
        stream += `BT /${font} ${l.size} Tf 1 0 0 1 ${xRight.toFixed(1)} ${baseline.toFixed(1)} Tm (${escapePdf(sanitasiPdf(l.right))}) Tj ET\n`;
      } else {
        const xLeft = MARGIN + l.indent;
        if (l.left)
          stream += `BT /${font} ${l.size} Tf 1 0 0 1 ${xLeft.toFixed(1)} ${baseline.toFixed(1)} Tm (${escapePdf(sanitasiPdf(l.left))}) Tj ET\n`;
      }
      y -= step;
    }
    // Nomor halaman
    stream += `BT /F1 8 Tf 1 0 0 1 ${(PAGE_W / 2 - 20).toFixed(1)} ${(MARGIN - 16).toFixed(1)} Tm (Halaman ${i + 1} dari ${n}) Tj ET\n`;
    const streamBuf = Buffer.from(stream, "latin1");
    const pageBody =
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 ${fontReg} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`;
    const contentBody = Buffer.concat([
      Buffer.from(`${contentObj} 0 obj\n<< /Length ${streamBuf.length} >>\nstream\n`, "latin1"),
      streamBuf,
      Buffer.from("\nendstream\nendobj\n", "latin1"),
    ]);
    ordered.push({ num: pageObj, body: pageBody });
    ordered.push({ num: contentObj, body: contentBody });
  }

  for (const o of ordered) emit(o.body);
  const xrefPos = pos;
  const total = firstPageObj + n * 2;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) {
    xref += `${String(offsets[i - 1]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  parts.push(Buffer.from(xref + trailer, "latin1"));
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// XLSX (OOXML minimal, ZIP stored)
// ---------------------------------------------------------------------------

export type XlsxCell = { v: string | number; bold?: boolean; num?: boolean };
export type XlsxSheet = { name: string; rows: XlsxCell[][] };

/** Pemetaan baris dokumen -> baris sheet (kolom Uraian | Kode | Nilai). */
export function docBarisKeSheetRows(baris: DocBaris[]): XlsxCell[][] {
  const rows: XlsxCell[][] = [];
  for (const b of baris) {
    if (b.kind === "blank") rows.push([]);
    else if (b.kind === "header") rows.push([{ v: b.text, bold: true }]);
    else if (b.kind === "sub") rows.push([{ v: b.text, bold: true }]);
    else if (b.kind === "item")
      rows.push([{ v: b.nama }, { v: b.kode }, { v: Math.round(b.nilai), num: true }]);
    else if (b.kind === "total")
      rows.push([{ v: b.text, bold: true }, { v: "" }, { v: Math.round(b.nilai), bold: true, num: true }]);
    else if (b.kind === "note") rows.push([{ v: b.text }]);
  }
  return rows;
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
  const dims = `A1:${colName(2)}${sheet.rows.length}`;
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
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="${dims}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
    `<sheetFormat defaultRowHeight="15"/>` +
    `<cols><col min="1" max="1" width="52" customWidth="1"/><col min="2" max="2" width="14" customWidth="1"/><col min="3" max="3" width="22" customWidth="1"/></cols>` +
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

  // ZIP (stored, tanpa kompresi) — ditulis manual agar tanpa dependensi.
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // flag UTF-8
    local.writeUInt16LE(0, 8); // stored
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

/** Nama file unduhan, ex: Neraca_PT_Bumi_Surya_Farm_2026-09-30.pdf */
export function namaFileDokumen(prefix: string, ext: "pdf" | "xlsx", endIso: string): string {
  const d = new Date(endIso);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `${prefix}_${ymd}.${ext}`;
}
