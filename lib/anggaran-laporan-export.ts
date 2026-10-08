// Export Laporan Anggaran (detail per anggaran) mengikuti template PDF referensi:
// - Nama perusahaan di tengah atas, nama/periode anggaran, periode laporan,
//   "(dalam IDR)".
// - Tabel kolom "Akun" + masing-masing bulan (+ Total).
// - Section: Revenue, Cost of Sales, Gross Profit, Operational Expense,
//   Total dari Operational Expense, Operating Profit, Other Income (Expense),
//   Other Income, Other Expense, Total dari Other Income (Expense), Profit (Loss).
// - Total memakai garis pemisah; angka rata kanan format akuntansi
//   1.200.000,00 / (1.200.000,00); footer kiri periode+perusahaan,
//   kanan "Page X of Y"; multi-halaman otomatis.
// - XLSX memakai builder bersama lib/dokumen-export.ts.
// Data dari snapshot yang sama dengan halaman web (angka identik, data asli).

import type { AnggaranDetailSnapshot } from "@/lib/anggaran-laporan-server";
import {
  DOKUMEN_PERUSAHAAN,
  buildXlsx,
  namaFileDokumen,
  type XlsxCell,
  type XlsxSheet,
} from "@/lib/dokumen-export";

export { buildXlsx };
export type { XlsxSheet };

/** Format angka akuntansi referensi: 1.200.000,00 / (1.200.000,00). */
export function formatAkuntansi(n: number): string {
  const v = Math.round(Number(n) || 0);
  const abs = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ",00";
  return v < 0 ? `(${abs})` : abs;
}

// ---------------------------------------------------------------------------
// Model baris tabular bersama (PDF & XLSX)
// ---------------------------------------------------------------------------

type BarisAnggaran =
  | { kind: "grup"; text: string }
  | { kind: "akun"; kode: string; nama: string; vals: number[]; total: number }
  | { kind: "total"; text: string; vals: number[]; total: number; garisAtas?: boolean; garisBawah?: boolean };

function snapshotKeBaris(s: AnggaranDetailSnapshot): BarisAnggaran[] {
  const akun = (a: { kode: string; nama: string; bulan: number[]; total: number }): BarisAnggaran => ({
    kind: "akun",
    kode: a.kode,
    nama: a.nama,
    vals: a.bulan,
    total: a.total,
  });
  const total = (text: string, vals: number[], garisAtas = true, garisBawah = false): BarisAnggaran => ({
    kind: "total",
    text,
    vals,
    total: vals.reduce((x, v) => x + v, 0),
    garisAtas,
    garisBawah,
  });
  const out: BarisAnggaran[] = [
    { kind: "grup", text: "Revenue" },
    ...s.revenue.akun.map(akun),
    { kind: "grup", text: "Cost of Sales" },
    ...s.cos.akun.map(akun),
    total("Gross Profit", s.grossProfit.bulan),
    { kind: "grup", text: "Operational Expense" },
    ...s.opex.akun.map(akun),
    total("Total dari Operational Expense", s.opexTotal.bulan),
    total("Operating Profit", s.operatingProfit.bulan),
    { kind: "grup", text: "Other Income (Expense)" },
    { kind: "grup", text: "Other Income" },
    ...s.otherIncome.akun.map(akun),
    { kind: "grup", text: "Other Expense" },
    ...s.otherExpense.akun.map(akun),
    total("Total dari Other Income (Expense)", s.otherTotal.bulan),
    total("Profit (Loss)", s.profit.bulan, true, true),
  ];
  return out;
}

// ---------------------------------------------------------------------------
// XLSX (builder bersama)
// ---------------------------------------------------------------------------

export function snapshotKeSheetAnggaran(s: AnggaranDetailSnapshot, sheetName: string): XlsxSheet {
  const head: XlsxCell[] = [{ v: "Akun", bold: true }];
  for (const b of s.bulan) head.push({ v: b.label, bold: true });
  head.push({ v: "Total", bold: true });
  const rows: XlsxCell[][] = [
    [{ v: DOKUMEN_PERUSAHAAN, bold: true }],
    [{ v: s.nama, bold: true }],
    [{ v: s.label }],
    [{ v: "(dalam IDR)" }],
    [],
    head,
  ];
  for (const b of snapshotKeBaris(s)) {
    if (b.kind === "grup") {
      rows.push([{ v: b.text.toUpperCase(), bold: true }]);
    } else if (b.kind === "akun") {
      rows.push([
        { v: `${b.kode} - ${b.nama}` },
        ...b.vals.map((v): XlsxCell => ({ v: Math.round(v), num: true })),
        { v: Math.round(b.total), bold: true, num: true },
      ]);
    } else {
      rows.push([
        { v: b.text, bold: true },
        ...b.vals.map((v): XlsxCell => ({ v: Math.round(v), bold: true, num: true })),
        { v: Math.round(b.total), bold: true, num: true },
      ]);
    }
  }
  rows.push([]);
  rows.push([{ v: "Catatan:", bold: true }]);
  for (const c of s.catatan) rows.push([{ v: `- ${c}` }]);
  return { name: sheetName.slice(0, 31), rows };
}

// ---------------------------------------------------------------------------
// PDF referensi (landscape; periode anggaran maks 6 bulan + Total)
// ---------------------------------------------------------------------------

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 36;

const X_AKUN = MARGIN;
const COL_W = 76;
const LABEL_W = 190;

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
  | { kind: "grup"; text: string }
  | { kind: "head"; kolom: string[] }
  | { kind: "row"; uraian: string[]; vals: string[]; bold: boolean; garisAtas?: boolean; garisBawah?: boolean };

function snapshotKeLines(s: AnggaranDetailSnapshot): PdfLine[] {
  const lines: PdfLine[] = [
    { kind: "center", text: DOKUMEN_PERUSAHAAN, size: 12, bold: true },
    { kind: "center", text: s.nama, size: 11, bold: true },
    { kind: "center", text: s.label, size: 9.5, bold: true },
    { kind: "center", text: "(dalam IDR)", size: 9.5, bold: true },
    { kind: "left", text: "", size: 9, bold: false },
    { kind: "head", kolom: s.bulan.map((b) => b.label) },
  ];
  for (const b of snapshotKeBaris(s)) {
    if (b.kind === "grup") {
      lines.push({ kind: "grup", text: b.text.toUpperCase() });
    } else if (b.kind === "akun") {
      lines.push({
        kind: "row",
        uraian: bungkusKata(`${b.kode} - ${b.nama}`, 32),
        vals: [...b.vals.map(formatAkuntansi), formatAkuntansi(b.total)],
        bold: false,
      });
    } else {
      lines.push({
        kind: "row",
        uraian: [b.text.toUpperCase()],
        vals: [...b.vals.map(formatAkuntansi), formatAkuntansi(b.total)],
        bold: true,
        garisAtas: b.garisAtas,
        garisBawah: b.garisBawah,
      });
    }
  }
  return lines;
}

export function buildAnggaranPdf(snapshots: AnggaranDetailSnapshot[]): Buffer {
  const pages: { line: PdfLine; yTop: number }[][] = [];
  let cur: { line: PdfLine; yTop: number }[] = [];
  let y = PAGE_H - MARGIN;
  const need = (l: PdfLine): number => {
    if (l.kind === "row" && l.uraian.length > 1) return l.uraian.length * 7.5 * 1.5;
    if (l.kind === "grup") return 13;
    if (l.kind === "head") return 13;
    if (l.kind === "center") return l.size * 1.5;
    return (l as { size: number }).size * 1.5;
  };
  const push = (line: PdfLine) => {
    const h = need(line) || 12;
    if (y - h < MARGIN + 12) {
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
  const drawRight = (t: string, size: number, bold: boolean, rightEdge: number, baseline: number) =>
    draw(t, size, bold, rightEdge - lebarTeks(sanitasiPdf(t), size), baseline);
  const rightX = (pos2: number) => LABEL_W + MARGIN + (pos2 + 1) * COL_W;
  const garis = (x1: number, x2: number, yy: number) =>
    `0.5 w\n${x1.toFixed(1)} ${yy.toFixed(1)} m ${x2.toFixed(1)} ${yy.toFixed(1)} l S\n`;

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
        stream += draw(line.text, 8.5, true, X_AKUN, yTop - 11);
      } else if (line.kind === "head") {
        const base = yTop - 10;
        stream += draw("Akun", 7.5, true, X_AKUN, base);
        line.kolom.forEach((k, ki) => {
          stream += drawRight(k, 7.5, true, rightX(ki), base);
        });
        stream += drawRight("Total", 7.5, true, rightX(line.kolom.length), base);
        stream += garis(X_AKUN, rightX(line.kolom.length), yTop - 13);
      } else {
        const size = 7.5;
        const step = size * 1.5;
        const top = yTop - 1;
        if (line.garisAtas) stream += garis(X_AKUN, rightX(line.vals.length - 1), top);
        line.uraian.forEach((u, li) => {
          const base = yTop - size - 2 - li * step;
          if (li === 0) {
            for (let vi = 0; vi < line.vals.length; vi++) {
              stream += drawRight(line.vals[vi], size, line.bold, rightX(vi), base);
            }
          }
          stream += draw(u, size, line.bold, X_AKUN, base);
        });
        if (line.garisBawah) {
          const bottom = yTop - size - 2 - (line.uraian.length - 1) * step - 4;
          stream += garis(X_AKUN, rightX(line.vals.length - 1), bottom);
        }
      }
    }
    const snapLabel = snapshots[Math.min(i, snapshots.length - 1)].label;
    stream += draw(`${DOKUMEN_PERUSAHAAN} — ${snapLabel}`, 7.5, false, MARGIN, MARGIN - 14);
    const pg = `Page ${i + 1} of ${n}`;
    stream += drawRight(pg, 7.5, false, PAGE_W - MARGIN, MARGIN - 14);
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

/** Nama file unduhan, ex: Anggaran_Laba_Rugi_Nama_2026-06_s/d_2026-08.pdf */
export function anggaranNamaFile(ext: "pdf" | "xlsx", s: AnggaranDetailSnapshot): string {
  const awal = s.bulan[0];
  const akhir = s.bulan[s.bulan.length - 1];
  const aman = s.nama.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 40) || "Anggaran";
  const periode = `${awal.tahun}-${String(awal.bulan).padStart(2, "0")}_s/d_${akhir.tahun}-${String(akhir.bulan).padStart(2, "0")}`;
  return namaFileDokumen(`Anggaran_Laba_Rugi_${aman}_${periode}`, ext, `${akhir.tahun}-${String(akhir.bulan).padStart(2, "0")}-01`);
}
