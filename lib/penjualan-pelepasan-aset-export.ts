// Export Laporan Penjualan/Pelepasan Aset Tetap (mandiri - tidak mengubah builder lain).
// PDF landscape A4, XLSX semua kolom, memakai snapshot API yang sama dengan web.
// Tidak ada data dummy: seluruh angka berasal dari PenjualanPelepasanSnapshot.

import type { PenjualanPelepasanSnapshot } from "@/lib/penjualan-pelepasan-aset-types";

export const ASET_PERUSAHAAN = "PT BUMI SURYA FARM";

export function fmtTglEkspor(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

/** Rupiah untuk ekspor, tanpa karakter non-ASCII, ex: "Rp 1.000.000". */
export function formatRupiahEkspor(n: number): string {
  return `Rp ${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;
}

// ---------------------------------------------------------------------------
// PDF (PDF 1.4, landscape A4, font base-14)
// ---------------------------------------------------------------------------

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 36;

const X_NO = MARGIN;
const X_NAMA = 78;
const X_TGL_AKU = 178;
const X_TGL_LEP = 248;
const X_BIAYA_R = 420;
const X_AKUM_R = 500;
const X_NILAI_R = 580;
const X_HARGA_R = 650;
const X_UNTUNG_R = 720;
const X_STATUS_R = 790; // right edge for status

const HELV_W: Record<string, number> = {
  " ": 278, "(": 333, ")": 333, ",": 333, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
  "8": 556, "9": 556, R: 722, p: 556, r: 333,
};

function lebarTeks(t: string, size: number): number {
  let w = 0;
  for (const ch of t) w += HELV_W[ch] ?? 550;
  return (w / 1000) * size;
}

function sanitasiPdf(t: string): string {
  const map: Record<string, string> = {
    "–": "-", "—": "-", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...",
    "−": "-", "\u00a0": " ",
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

function potong(t: string, max: number): string {
  const s = (t || "").replace(/\s+/g, " ").trim() || "-";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function wrapText(t: string, size: number, maxWidth: number): string[] {
  const words = sanitasiPdf(t).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (lebarTeks(candidate, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

type PdfLine =
  | { kind: "center"; text: string; size: number; bold: boolean }
  | { kind: "left"; text: string; size: number; bold: boolean }
  | { kind: "head" }
  | { kind: "group"; text: string }
  | {
      kind: "row";
      no: string;
      nama: string;
      tglAku: string;
      tglLepas: string;
      biaya: string;
      akum: string;
      buku: string;
      harga: string;
      untung: string;
      status: string;
      akunPenerima: string;
      bold: boolean;
    }
  | { kind: "subtotal"; label: string; biaya: string; akum: string; buku: string; harga: string; untung: string }
  | { kind: "total"; biaya: string; akum: string; buku: string; harga: string; untung: string };

function snapshotKeLines(s: PenjualanPelepasanSnapshot): PdfLine[] {
  const lines: PdfLine[] = [
    { kind: "center", text: ASET_PERUSAHAAN, size: 12, bold: true },
    { kind: "center", text: "Penjualan / Pelepasan Aset Tetap", size: 12, bold: true },
    { kind: "center", text: s.label, size: 9.5, bold: true },
    { kind: "center", text: "(dalam Rupiah)", size: 9.5, bold: true },
    { kind: "left", text: "", size: 9, bold: false },
    { kind: "head" },
  ];

  if (s.totalAset === 0) {
    lines.push({
      kind: "left",
      text: "Tidak ada penjualan atau pelepasan aset tetap pada periode ini.",
      size: 9,
      bold: false,
    });
  }

  for (const g of s.kelompok) {
    const label =
      g.kode === "(tanpa akun)" ? "Tanpa akun aset" : `${g.kode} - ${g.nama}`;
    lines.push({ kind: "group", text: label });
    for (const b of g.baris) {
      lines.push({
        kind: "row",
        no: potong(b.nomorAset, 10),
        nama: potong(b.namaAset, 26),
        tglAku: fmtTglEkspor(b.tanggalAkuisisi),
        tglLepas: fmtTglEkspor(b.tanggalPelepasan),
        biaya: formatRupiahEkspor(b.biayaAwal),
        akum: formatRupiahEkspor(b.akumulasiPenyusutan),
        buku: formatRupiahEkspor(b.nilaiBuku),
        harga: formatRupiahEkspor(b.hargaJual),
        untung:
          b.untungRugi >= 0
            ? `+${formatRupiahEkspor(b.untungRugi)}`
            : `−${formatRupiahEkspor(Math.abs(b.untungRugi))}`,
        status: b.statusLabel,
        akunPenerima: b.akunPenerima === "-" ? "-" : `${b.akunPenerima} - ${b.akunPenerimaNama}`,
        bold: false,
      });
    }
    lines.push({
      kind: "subtotal",
      label:
        g.kode === "(tanpa akun)" ? "Subtotal tanpa akun" : `Subtotal ${g.kode}`,
      biaya: formatRupiahEkspor(g.subtotalBiayaAwal),
      akum: formatRupiahEkspor(g.subtotalAkumulasiPenyusutan),
      buku: formatRupiahEkspor(g.subtotalNilaiBuku),
      harga: formatRupiahEkspor(g.subtotalHargaJual),
      untung:
        g.subtotalUntungRugi >= 0
          ? `+${formatRupiahEkspor(g.subtotalUntungRugi)}`
          : `−${formatRupiahEkspor(Math.abs(g.subtotalUntungRugi))}`,
    });
  }

  lines.push({
    kind: "total",
    biaya: formatRupiahEkspor(s.totalBiayaAwal),
    akum: formatRupiahEkspor(s.totalAkumulasiPenyusutan),
    buku: formatRupiahEkspor(s.totalNilaiBuku),
    harga: formatRupiahEkspor(s.totalHargaJual),
    untung:
      s.totalUntungRugi >= 0
        ? `+${formatRupiahEkspor(s.totalUntungRugi)}`
        : `−${formatRupiahEkspor(Math.abs(s.totalUntungRugi))}`,
  });

  if (s.catatan.length > 0) {
    lines.push({ kind: "left", text: "", size: 8, bold: false });
    lines.push({ kind: "left", text: "Catatan:", size: 7.5, bold: true });
    for (const note of s.catatan) {
      for (const w of wrapText(note, 7, PAGE_W - MARGIN * 2)) {
        lines.push({ kind: "left", text: w, size: 7, bold: false });
      }
    }
  }

  return lines;
}

function tanggalLaporan(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function buildPenjualanPelepasanPdf(
  snapshots: PenjualanPelepasanSnapshot[]
): Buffer {
  const pages: { line: PdfLine; yTop: number }[][] = [];
  let cur: { line: PdfLine; yTop: number }[] = [];
  let y = PAGE_H - MARGIN;

  const need = (l: PdfLine): number => {
    if (l.kind === "head") return 22;
    if (l.kind === "center") return l.size * 1.5;
    if (l.kind === "row" || l.kind === "group" || l.kind === "subtotal" || l.kind === "total")
      return 7 * 1.45;
    return l.size * 1.6;
  };

  const push = (line: PdfLine) => {
    const h = need(line) || 12;
    if (y - h < MARGIN + 14) {
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

  const tglLap = tanggalLaporan();
  for (let i = 0; i < n; i++) {
    const pageObj = firstPageObj + i * 2;
    const contentObj = pageObj + 1;
    let stream = "";

    for (const { line, yTop } of pages[i]) {
      if (line.kind === "center") {
        const w = lebarTeks(sanitasiPdf(line.text), line.size);
        stream += draw(line.text, line.size, line.bold, (PAGE_W - w) / 2, yTop - line.size - 2);
      } else if (line.kind === "left") {
        if (line.text) stream += draw(line.text, line.size, line.bold, MARGIN, yTop - line.size - 2);
      } else if (line.kind === "head") {
        const bot = yTop - 13;
        stream += draw("Aset", 6.5, true, X_NO, bot);
        stream += draw("Tgl Akuisisi", 6.5, true, X_TGL_AKU, bot);
        stream += draw("Tgl Pelepasan", 6.5, true, X_TGL_LEP, bot);
        stream += drawRight("Biaya Awal", 6.5, true, X_BIAYA_R, bot);
        stream += drawRight("Akumulasi", 6.5, true, X_AKUM_R, bot);
        stream += drawRight("Nilai Buku", 6.5, true, X_NILAI_R, bot);
        stream += drawRight("Harga Jual", 6.5, true, X_HARGA_R, bot);
        stream += drawRight("Untung/Rugi", 6.5, true, X_UNTUNG_R, bot);
        stream += drawRight("Status", 6.5, true, X_STATUS_R, bot);
      } else if (line.kind === "group") {
        const size = 7;
        stream += draw(line.text, size, true, X_NO, yTop - size - 2);
      } else if (line.kind === "row") {
        const size = 6.5;
        const base = yTop - size - 2;
        const f = line.bold;
        stream += draw(line.no, size, f, X_NO, base);
        stream += draw(line.nama, size, f, X_NAMA, base);
        stream += draw(line.tglAku, size, f, X_TGL_AKU, base);
        stream += draw(line.tglLepas, size, f, X_TGL_LEP, base);
        stream += drawRight(line.biaya, size, f, X_BIAYA_R, base);
        stream += drawRight(line.akum, size, f, X_AKUM_R, base);
        stream += drawRight(line.buku, size, f, X_NILAI_R, base);
        stream += drawRight(line.harga, size, f, X_HARGA_R, base);
        stream += drawRight(line.untung, size, f, X_UNTUNG_R, base);
        stream += drawRight(line.status, size, f, X_STATUS_R, base);
      } else if (line.kind === "subtotal") {
        const size = 7;
        const base = yTop - size - 2;
        stream += draw(line.label, size, true, X_NO, base);
        stream += drawRight(line.biaya, size, true, X_BIAYA_R, base);
        stream += drawRight(line.akum, size, true, X_AKUM_R, base);
        stream += drawRight(line.buku, size, true, X_NILAI_R, base);
        stream += drawRight(line.harga, size, true, X_HARGA_R, base);
        stream += drawRight(line.untung, size, true, X_UNTUNG_R, base);
      } else {
        const size = 7;
        const base = yTop - size - 2;
        stream += draw("TOTAL", size, true, X_NO, base);
        stream += drawRight(line.biaya, size, true, X_BIAYA_R, base);
        stream += drawRight(line.akum, size, true, X_AKUM_R, base);
        stream += drawRight(line.buku, size, true, X_NILAI_R, base);
        stream += drawRight(line.harga, size, true, X_HARGA_R, base);
        stream += drawRight(line.untung, size, true, X_UNTUNG_R, base);
      }
    }

    stream += draw(`Penjualan/Pelepasan Aset - ${tglLap}`, 7, false, MARGIN, MARGIN - 16);
    stream += drawRight(`Halaman ${i + 1} dari ${n}`, 7, false, PAGE_W - MARGIN, MARGIN - 16);
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
// XLSX (OOXML minimal, ZIP stored)
// ---------------------------------------------------------------------------

export type XlsxCell = { v: string | number; bold?: boolean; num?: boolean };
export type XlsxSheet = { name: string; rows: XlsxCell[][] };

const KOLOM = [
  "Nomor Aset",
  "Nama Aset",
  "Tanggal Akuisisi",
  "Tanggal Pelepasan",
  "Biaya Awal",
  "Akumulasi Penyusutan",
  "Nilai Buku",
  "Harga Jual",
  "Untung/Rugi",
  "Status",
  "Akun Penerima/Piutang",
];

export function snapshotKeSheetPenjualanPelepasan(
  s: PenjualanPelepasanSnapshot,
  sheetName: string
): XlsxSheet {
  const rows: XlsxCell[][] = [
    [{ v: ASET_PERUSAHAAN, bold: true }],
    [{ v: "Penjualan / Pelepasan Aset Tetap", bold: true }],
    [{ v: s.label }],
    [{ v: "(dalam Rupiah)" }],
    [],
    KOLOM.map((v) => ({ v, bold: true })),
  ];

  if (s.totalAset === 0) {
    rows.push([{ v: "Tidak ada penjualan atau pelepasan aset tetap pada periode ini." }]);
  }

  for (const g of s.kelompok) {
    const label =
      g.kode === "(tanpa akun)" ? "Tanpa akun aset" : `${g.kode} - ${g.nama}`;
    rows.push([{ v: label, bold: true }]);
    for (const b of g.baris) {
      rows.push([
        { v: b.nomorAset },
        { v: b.namaAset },
        { v: fmtTglEkspor(b.tanggalAkuisisi) },
        { v: fmtTglEkspor(b.tanggalPelepasan) },
        { v: b.biayaAwal, num: true },
        { v: b.akumulasiPenyusutan, num: true },
        { v: b.nilaiBuku, num: true },
        { v: b.hargaJual, num: true },
        { v: b.untungRugi, num: true },
        { v: b.statusLabel },
        { v: b.akunPenerima === "-" ? "-" : `${b.akunPenerima} - ${b.akunPenerimaNama}` },
      ]);
    }
    rows.push([
      { v: g.kode === "(tanpa akun)" ? "Subtotal tanpa akun" : `Subtotal ${g.kode}`, bold: true },
      { v: "" },
      { v: "" },
      { v: "" },
      { v: g.subtotalBiayaAwal, bold: true, num: true },
      { v: g.subtotalAkumulasiPenyusutan, bold: true, num: true },
      { v: g.subtotalNilaiBuku, bold: true, num: true },
      { v: g.subtotalHargaJual, bold: true, num: true },
      { v: g.subtotalUntungRugi, bold: true, num: true },
      { v: "" },
      { v: "" },
    ]);
  }

  rows.push([
    { v: "TOTAL", bold: true },
    { v: "" },
    { v: "" },
    { v: "" },
    { v: s.totalBiayaAwal, bold: true, num: true },
    { v: s.totalAkumulasiPenyusutan, bold: true, num: true },
    { v: s.totalNilaiBuku, bold: true, num: true },
    { v: s.totalHargaJual, bold: true, num: true },
    { v: s.totalUntungRugi, bold: true, num: true },
    { v: "" },
    { v: "" },
  ]);

  if (s.catatan.length > 0) {
    rows.push([]);
    rows.push([{ v: "Catatan:", bold: true }]);
    for (const note of s.catatan) rows.push([{ v: note }]);
  }

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
  const widths = [12, 26, 13, 13, 16, 16, 16, 16, 16, 22, 22]
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
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellStyleXfs>` +
    `<cellXfs count="4">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files = [
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

function ymdLokal(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** Nama file unduhan, ex: Penjualan_Pelepasan_Aset_PT_Bumi_Surya_Farm_20261001_20261031.pdf */
export function penjualanPelepasanNamaFile(ext: "pdf" | "xlsx", dari: Date, sampai: Date): string {
  return `Penjualan_Pelepasan_Aset_PT_Bumi_Surya_Farm_${ymdLokal(dari)}_${ymdLokal(sampai)}.${ext}`;
}
