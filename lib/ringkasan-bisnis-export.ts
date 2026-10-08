// Adaptor export Laporan Ringkasan Bisnis di atas builder generik
// (lib/dokumen-export.ts) — tanpa template export baru.
// Struktur: Laba Rugi -> Neraca -> Arus Kas -> Wawasan Bisnis -> Catatan.
// Data dari snapshot yang sama dengan halaman web.

import type { RingkasanBisnisSnapshot } from "@/lib/ringkasan-bisnis-types";
import {
  DOKUMEN_PERUSAHAAN,
  buildDokumenPdf,
  docBarisKeSheetRows,
  namaFileDokumen,
  type DocBaris,
  type XlsxSheet,
} from "@/lib/dokumen-export";

export function formatRasio(v: number | null, satuan: "%" | "x"): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (satuan === "%") return `${(v * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
  return `${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })}x`;
}

export function snapshotKeBarisRB(s: RingkasanBisnisSnapshot): DocBaris[] {
  const lr = s.labaRugi;
  const nr = s.neraca;
  const ak = s.arusKas;

  // Seluruh baris nominal memakai kind "total" (teks + nominal rata kanan,
  // tanpa kolom kode) karena ringkasan ini agregat lintas laporan.
  const t = (text: string, nilai: number): DocBaris => ({ kind: "total", text, nilai });

  return [
    { kind: "header", text: DOKUMEN_PERUSAHAAN },
    { kind: "header", text: "RINGKASAN BISNIS" },
    { kind: "sub", text: s.label },
    { kind: "sub", text: "(dalam IDR)" },
    { kind: "blank" },
    { kind: "sub", text: "Laba Rugi" },
    t("Pendapatan", lr.pendapatan),
    t("Harga Pokok Penjualan", lr.hpp),
    t("Laba Kotor", lr.labaKotor),
    t("Biaya Operasional", lr.biayaOperasional),
    t("Laba Operasional", lr.labaOperasional),
    t("Pendapatan Lainnya", lr.pendapatanLainnya),
    t("Biaya Lainnya", lr.biayaLainnya),
    t("Keuntungan Bersih / (Rugi)", lr.labaBersih),
    { kind: "blank" },
    { kind: "sub", text: "Neraca" },
    t("Aset Lancar", nr.asetLancar),
    t("Aset Tidak Lancar", nr.asetTetap - nr.penyusutan),
    t("Total Aset", nr.totalAset),
    t("Liabilitas Jangka Pendek", nr.liabilitasPendek),
    t("Liabilitas Jangka Panjang", nr.liabilitasPanjang),
    t("Modal Pemilik", nr.modal),
    t("Total Liabilitas + Modal", nr.totalLiabilitasModal),
    { kind: "blank" },
    { kind: "sub", text: "Arus Kas" },
    t("Kas dari Aktivitas Operasional", ak.operasional),
    t("Kas dari Aktivitas Investasi", ak.investasi),
    t("Kas dari Aktivitas Pendanaan", ak.pendanaan),
    t("Kenaikan / Penurunan Kas", ak.kenaikan),
    t("Saldo Kas Akhir", ak.saldoAkhir),
    { kind: "blank" },
    { kind: "sub", text: "Wawasan Bisnis" },
    ...s.wawasan.map((w): DocBaris => ({ kind: "note", text: `- ${w.nama}: ${formatRasio(w.nilai, w.satuan)}` })),
    { kind: "blank" },
    { kind: "sub", text: "Catatan:" },
    ...s.catatan.map((c): DocBaris => ({ kind: "note", text: `- ${c}` })),
  ];
}

export function buildRingkasanBisnisPdf(snapshots: RingkasanBisnisSnapshot[]): Buffer {
  return buildDokumenPdf(snapshots.map(snapshotKeBarisRB));
}

export function snapshotKeSheetRB(s: RingkasanBisnisSnapshot, sheetName: string): XlsxSheet {
  const rows = [
    [{ v: DOKUMEN_PERUSAHAAN, bold: true }],
    [{ v: "Ringkasan Bisnis", bold: true }],
    [{ v: s.label }],
    [{ v: "(dalam IDR)" }],
    [],
    [{ v: "Uraian", bold: true }, { v: "Kode", bold: true }, { v: "Nilai (IDR)", bold: true }],
  ] as XlsxSheet["rows"];
  rows.push(...docBarisKeSheetRows(snapshotKeBarisRB(s).slice(5)));
  return { name: sheetName.slice(0, 31), rows };
}

/** Nama file unduhan, ex: Ringkasan_Bisnis_PT_Bumi_Surya_Farm_2026-09-30.pdf */
export function ringkasanBisnisNamaFile(ext: "pdf" | "xlsx", endIso: string): string {
  return namaFileDokumen("Ringkasan_Bisnis_PT_Bumi_Surya_Farm", ext, endIso);
}
