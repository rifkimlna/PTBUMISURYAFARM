// Adaptor export Laporan Neraca di atas builder generik (lib/dokumen-export.ts).
// API publik file ini TIDAK berubah: snapshotKeBaris, buildNeracaPdf,
// snapshotKeSheet, buildXlsx, neracaNamaFile, formatIDREkspor.

import type { NeracaSnapshot } from "@/lib/neraca-types";
import {
  DOKUMEN_PERUSAHAAN,
  buildDokumenPdf,
  docBarisKeSheetRows,
  namaFileDokumen,
  type DocBaris,
  type XlsxSheet,
} from "@/lib/dokumen-export";

export { buildXlsx, formatIDREkspor } from "@/lib/dokumen-export";
export type { XlsxCell, XlsxSheet } from "@/lib/dokumen-export";

export const NERACA_PERUSAHAAN = DOKUMEN_PERUSAHAAN;

export function snapshotKeBaris(s: NeracaSnapshot): DocBaris[] {
  const kelompok = (
    judul: string,
    baris: { kode: string; nama: string; nilai: number }[],
    totalLabel: string,
    total: number,
    pengurang = false
  ): DocBaris[] => [
    { kind: "sub", text: judul },
    ...baris.map(
      (b): DocBaris => ({
        kind: "item",
        kode: b.kode,
        nama: b.nama,
        nilai: pengurang ? -b.nilai : b.nilai,
      })
    ),
    { kind: "total", text: totalLabel, nilai: pengurang ? -total : total },
    { kind: "blank" },
  ];

  return [
    { kind: "header", text: NERACA_PERUSAHAAN },
    { kind: "header", text: "NERACA" },
    { kind: "sub", text: s.label },
    { kind: "sub", text: "(dalam IDR)" },
    { kind: "blank" },
    { kind: "header", text: "AKTIVA" },
    ...kelompok(s.aktivaLancar.judul, s.aktivaLancar.baris, "Total Aktiva Lancar", s.aktivaLancar.total),
    ...kelompok(s.aktivaTetap.judul, s.aktivaTetap.baris, "Total Aktiva Tetap", s.aktivaTetap.total),
    ...kelompok(s.penyusutan.judul, s.penyusutan.baris, "Total Depresiasi & Amortisasi", s.penyusutan.total, true),
    { kind: "total", text: "Total Aktiva", nilai: s.totalAktiva },
    { kind: "blank" },
    { kind: "header", text: "KEWAJIBAN DAN MODAL" },
    ...kelompok(s.kewajibanLancar.judul, s.kewajibanLancar.baris, "Total Kewajiban Lancar", s.kewajibanLancar.total),
    { kind: "total", text: "Total Kewajiban", nilai: s.totalKewajiban },
    { kind: "blank" },
    ...kelompok(s.modal.judul, s.modal.baris, "Total Modal Pemilik", s.totalModal),
    { kind: "total", text: "Total Kewajiban dan Modal", nilai: s.totalKewajibanModal },
    { kind: "blank" },
    { kind: "sub", text: "Catatan:" },
    ...s.catatan.map((c): DocBaris => ({ kind: "note", text: `- ${c}` })),
  ];
}

export function buildNeracaPdf(snapshots: NeracaSnapshot[]): Buffer {
  return buildDokumenPdf(snapshots.map(snapshotKeBaris));
}

export function snapshotKeSheet(s: NeracaSnapshot, sheetName: string): XlsxSheet {
  const rows = [
    [{ v: NERACA_PERUSAHAAN, bold: true }],
    [{ v: "Neraca", bold: true }],
    [{ v: s.label }],
    [{ v: "(dalam IDR)" }],
    [],
    [{ v: "Uraian", bold: true }, { v: "Kode", bold: true }, { v: "Nilai (IDR)", bold: true }],
  ] as XlsxSheet["rows"];
  rows.push(...docBarisKeSheetRows(snapshotKeBaris(s).slice(5)));
  return { name: sheetName.slice(0, 31), rows };
}

/** Nama file unduhan, ex: Neraca_PT_Bumi_Surya_Farm_2026-09-30.pdf */
export function neracaNamaFile(ext: "pdf" | "xlsx", asOfIso: string): string {
  return namaFileDokumen("Neraca_PT_Bumi_Surya_Farm", ext, asOfIso);
}
