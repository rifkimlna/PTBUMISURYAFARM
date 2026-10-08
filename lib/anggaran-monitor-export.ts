// Export Monitor Anggaran Laba Rugi (anggaran vs aktual per periode).
// - XLSX memakai builder bersama lib/dokumen-export.ts (buildXlsx + XlsxSheet).
// - PDF memakai pola builder PDF 1.4 yang sama dengan laporan multi-kolom lain
//   (landscape; kolom dipecah per 3 periode agar tetap terbaca).
// Data dari snapshot yang sama dengan halaman web (angka identik).

import type { MonitorSnapshot } from "@/lib/anggaran-monitor-types";
import {
  DOKUMEN_PERUSAHAAN,
  buildXlsx,
  formatIDREkspor,
  namaFileDokumen,
  type XlsxCell,
  type XlsxSheet,
} from "@/lib/dokumen-export";

export { buildXlsx };
export type { XlsxSheet };

// ---------------------------------------------------------------------------
// Model baris tabular (dipakai PDF per potongan kolom & XLSX penuh)
// ---------------------------------------------------------------------------

type BarisNilai = {
  uraian: string;
  kode?: string;
  anggaran: number[];
  aktual: number[];
  bold?: boolean;
  indent?: boolean;
};

type BlokSection = { judul: string; baris: BarisNilai[]; total?: BarisNilai };

function snapshotKeBlok(s: MonitorSnapshot): { section: BlokSection[]; profit: BarisNilai[] } {
  const akunKeBaris = (a: { kode: string; nama: string; anggaran: number[]; aktual: number[] }): BarisNilai => ({
    uraian: a.nama,
    kode: a.kode,
    anggaran: a.anggaran,
    aktual: a.aktual,
    indent: true,
  });
  const totalOf = (judul: string, anggaran: number[], aktual: number[]): BarisNilai => ({
    uraian: judul,
    anggaran,
    aktual,
    bold: true,
  });
  const section = (judul: string, akun: { kode: string; nama: string; anggaran: number[]; aktual: number[] }[], tA: number[], tK: number[]): BlokSection => ({
    judul,
    baris: akun.map(akunKeBaris),
    total: totalOf(`Total dari ${judul}`, tA, tK),
  });
  return {
    section: [
      section("Revenue", s.revenue.akun, s.revenue.totalAnggaran, s.revenue.totalAktual),
      section("Cost of Sales", s.cos.akun, s.cos.totalAnggaran, s.cos.totalAktual),
      section("Operational Expense", s.opex.akun, s.opex.totalAnggaran, s.opex.totalAktual),
      section("Other Income", s.otherIncome.akun, s.otherIncome.totalAnggaran, s.otherIncome.totalAktual),
      section("Other Expense", s.otherExpense.akun, s.otherExpense.totalAnggaran, s.otherExpense.totalAktual),
    ],
    profit: [
      totalOf("Gross Profit", s.grossProfit.anggaran, s.grossProfit.aktual),
      totalOf("Operating Profit", s.operatingProfit.anggaran, s.operatingProfit.aktual),
      totalOf("Total dari Other Income (Expense)", s.otherTotal.anggaran, s.otherTotal.aktual),
      totalOf("Profit (Loss)", s.profit.anggaran, s.profit.aktual),
    ],
  };
}

// ---------------------------------------------------------------------------
// XLSX (matriks penuh: seluruh kolom + kolom Total)
// ---------------------------------------------------------------------------

export function snapshotKeSheetMonitor(s: MonitorSnapshot, sheetName: string): XlsxSheet {
  const n = s.kolom.length;
  const head1: XlsxCell[] = [{ v: "Uraian", bold: true }];
  const head2: XlsxCell[] = [{ v: "", bold: true }];
  for (const k of s.kolom) {
    head1.push({ v: k.label, bold: true }, { v: "", bold: true });
    head2.push({ v: "Anggaran", bold: true }, { v: "Aktual", bold: true });
  }
  head1.push({ v: "Total", bold: true }, { v: "", bold: true });
  head2.push({ v: "Anggaran", bold: true }, { v: "Aktual", bold: true });

  const rows: XlsxCell[][] = [
    [{ v: DOKUMEN_PERUSAHAAN, bold: true }],
    [{ v: `Anggaran Laba Rugi: ${s.anggaranNama}`, bold: true }],
    [{ v: s.label }],
    [{ v: "(dalam IDR)" }],
    [],
    head1,
    head2,
  ];

  const barisXlsx = (b: BarisNilai) => {
    const r: XlsxCell[] = [{ v: b.kode && b.kode !== "—" ? `${b.kode} - ${b.uraian}` : b.uraian, bold: b.bold }];
    for (let i = 0; i < n; i++) {
      r.push(
        { v: Math.round(b.anggaran[i] ?? 0), bold: b.bold, num: true },
        { v: Math.round(b.aktual[i] ?? 0), bold: b.bold, num: true }
      );
    }
    const tA = b.anggaran.reduce((x, v) => x + v, 0);
    const tK = b.aktual.reduce((x, v) => x + v, 0);
    r.push({ v: Math.round(tA), bold: true, num: true }, { v: Math.round(tK), bold: true, num: true });
    return r;
  };

  const { section, profit } = snapshotKeBlok(s);
  const urutan: (BlokSection | BarisNilai)[] = [
    section[0],
    section[1],
    profit[0],
    section[2],
    profit[1],
    section[3],
    section[4],
    profit[2],
    profit[3],
  ];
  for (const b of urutan) {
    if ("baris" in b) {
      rows.push([{ v: b.judul.toUpperCase(), bold: true }]);
      for (const r of b.baris) rows.push(barisXlsx(r));
      if (b.total) rows.push(barisXlsx(b.total));
      rows.push([]);
    } else {
      rows.push(barisXlsx(b));
    }
  }
  rows.push([]);
  rows.push([{ v: "Catatan:", bold: true }]);
  for (const c of s.catatan) rows.push([{ v: `- ${c}` }]);
  return { name: sheetName.slice(0, 31), rows };
}

// ---------------------------------------------------------------------------
// PDF landscape (kolom dipecah: max 3 periode per potongan + Total di akhir)
// ---------------------------------------------------------------------------

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 36;

const X_URAIAN = MARGIN;
const COL_W = 76;
const LABEL_W = 150;

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
  | { kind: "head"; kolom: string[]; total?: boolean }
  | { kind: "row"; uraian: string[]; vals: string[]; bold: boolean };

const CHUNK = 3;

function potonganKolom(n: number): { mulai: number; akhir: number; total: boolean }[] {
  const out: { mulai: number; akhir: number; total: boolean }[] = [];
  for (let i = 0; i < n; i += CHUNK) {
    const akhir = Math.min(i + CHUNK, n);
    out.push({ mulai: i, akhir, total: akhir === n });
  }
  if (out.length === 0) out.push({ mulai: 0, akhir: 0, total: true });
  return out;
}

function snapshotKeLinesChunk(s: MonitorSnapshot, mulai: number, akhir: number, denganTotal: boolean): PdfLine[] {
  const idx: number[] = [];
  for (let i = mulai; i < akhir; i++) idx.push(i);
  const lines: PdfLine[] = [
    { kind: "center", text: DOKUMEN_PERUSAHAAN, size: 12, bold: true },
    { kind: "center", text: `Anggaran Laba Rugi: ${s.anggaranNama}`, size: 11, bold: true },
    { kind: "center", text: s.label, size: 9, bold: true },
    { kind: "center", text: "(dalam IDR)", size: 9, bold: true },
    { kind: "left", text: "", size: 9, bold: false },
    {
      kind: "head",
      kolom: idx.map((i) => s.kolom[i].label),
      total: denganTotal,
    },
  ];
  const selTotal = (arr: number[]) => formatIDREkspor(arr.reduce((x, v) => x + v, 0));

  const row = (b: BarisNilai): PdfLine => {
    const vals: string[] = [];
    for (let i = 0; i < idx.length; i++) {
      vals.push(formatIDREkspor(b.anggaran[idx[i]] ?? 0), formatIDREkspor(b.aktual[idx[i]] ?? 0));
    }
    if (denganTotal) vals.push(selTotal(b.anggaran), selTotal(b.aktual));
    const label = b.kode && b.kode !== "—" ? `${b.kode} - ${b.uraian}` : b.uraian;
    return { kind: "row", uraian: bungkusKata(label, 26), vals, bold: !!b.bold };
  };

  const { section, profit } = snapshotKeBlok(s);
  const urutan: (BlokSection | BarisNilai)[] = [
    section[0],
    section[1],
    profit[0],
    section[2],
    profit[1],
    section[3],
    section[4],
    profit[2],
    profit[3],
  ];
  for (const b of urutan) {
    if ("baris" in b) {
      lines.push({ kind: "grup", text: b.judul.toUpperCase() });
      for (const r of b.baris) lines.push(row(r));
      if (b.total) lines.push(row(b.total));
    } else {
      lines.push(row(b));
    }
  }
  return lines;
}

export function buildMonitorPdf(snapshots: MonitorSnapshot[]): Buffer {
  const pages: { line: PdfLine; yTop: number; chunk: number }[][] = [];
  let cur: { line: PdfLine; yTop: number; chunk: number }[] = [];
  let y = PAGE_H - MARGIN;
  const need = (l: PdfLine): number => {
    if (l.kind === "row" && l.uraian.length > 1) return l.uraian.length * 7 * 1.5;
    if (l.kind === "grup") return 13;
    if (l.kind === "head") return 24;
    if (l.kind === "center") return l.size * 1.5;
    return (l as { size: number }).size * 1.5;
  };
  const push = (line: PdfLine, ci: number) => {
    const h = need(line) || 12;
    if (y - h < MARGIN) {
      pages.push(cur);
      cur = [];
      y = PAGE_H - MARGIN;
    }
    cur.push({ line, yTop: y, chunk: ci });
    y -= h;
  };
  snapshots.forEach((s, si) => {
    const pots = potonganKolom(s.kolom.length);
    pots.forEach((p, pi) => {
      if (pi > 0) {
        pages.push(cur);
        cur = [];
        y = PAGE_H - MARGIN;
      }
      for (const l of snapshotKeLinesChunk(s, p.mulai, p.akhir, p.total)) push(l, pi);
    });
    if (si !== snapshots.length - 1) {
      pages.push(cur);
      cur = [];
      y = PAGE_H - MARGIN;
    }
  });
  if (cur.length) pages.push(cur);
  if (pages.length === 0) pages.push([]);

  const rightX = (pos: number) => LABEL_W + MARGIN + (pos + 1) * COL_W;

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
        stream += draw(line.text, 8.5, true, X_URAIAN, yTop - 11);
      } else if (line.kind === "head") {
        const top = yTop - 9;
        const bot = yTop - 20;
        stream += draw("Uraian", 7, true, X_URAIAN, bot);
        line.kolom.forEach((k, ki) => {
          const cx = LABEL_W + MARGIN + ki * 2 * COL_W + COL_W;
          const w = lebarTeks(sanitasiPdf(k), 7);
          stream += draw(k, 7, true, cx - w / 2, top);
          stream += drawRight("Angg.", 6.5, true, LABEL_W + MARGIN + ki * 2 * COL_W + COL_W, bot);
          stream += drawRight("Aktual", 6.5, true, LABEL_W + MARGIN + ki * 2 * COL_W + 2 * COL_W, bot);
        });
        if (line.total) {
          const bx = LABEL_W + MARGIN + line.kolom.length * 2 * COL_W;
          stream += draw("Total", 7, true, bx + COL_W - 20, top);
          stream += drawRight("Angg.", 6.5, true, bx + COL_W, bot);
          stream += drawRight("Aktual", 6.5, true, bx + 2 * COL_W, bot);
        }
      } else {
        const size = 7;
        const step = size * 1.5;
        const valsPerRow = line.vals.length;
        line.uraian.forEach((u, li) => {
          const base = yTop - size - 2 - li * step;
          if (li === 0) {
            for (let vi = 0; vi < valsPerRow; vi++) {
              stream += drawRight(line.vals[vi], size, line.bold, rightX(vi), base);
            }
          }
          stream += draw(u, size, line.bold, X_URAIAN, base);
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

/** Nama file unduhan, ex: Anggaran_Laba_Rugi_Monitor_Nama_2026-12.pdf */
export function anggaranMonitorNamaFile(ext: "pdf" | "xlsx", berakhirPada: string, nama?: string): string {
  const aman = (nama ?? "Anggaran").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 40) || "Anggaran";
  return namaFileDokumen(`Anggaran_Laba_Rugi_${aman}_${berakhirPada}`, ext, `${berakhirPada}-01`);
}
