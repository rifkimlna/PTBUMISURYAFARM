// Adaptor export Laporan Laba Rugi di atas builder generik (lib/dokumen-export.ts).
// Struktur mengikuti referensi: Pendapatan -> HPP -> Laba Kotor -> Biaya
// Operasional -> Operasional Bersih -> Pendapatan/ Biaya Lainnya -> Laba Bersih
// -> Total Komprehensif. Data dari snapshot yang sama dengan halaman web.

import type { LabaRugiSnapshot } from "@/lib/laba-rugi-types";
import {
  DOKUMEN_PERUSAHAAN,
  buildDokumenPdf,
  docBarisKeSheetRows,
  namaFileDokumen,
  type DocBaris,
  type XlsxSheet,
} from "@/lib/dokumen-export";

export function snapshotKeBarisLR(s: LabaRugiSnapshot): DocBaris[] {
  const items = (baris: { kode: string; nama: string; nilai: number }[]): DocBaris[] =>
    baris.map((b): DocBaris => ({ kind: "item", kode: b.kode, nama: b.nama, nilai: b.nilai }));

  return [
    { kind: "header", text: DOKUMEN_PERUSAHAAN },
    { kind: "header", text: "LABA RUGI" },
    { kind: "sub", text: s.label },
    { kind: "sub", text: "(dalam IDR)" },
    { kind: "blank" },
    { kind: "header", text: "PENDAPATAN" },
    { kind: "sub", text: s.penjualan.judul },
    ...items(s.penjualan.baris),
    { kind: "total", text: "Penjualan", nilai: s.penjualan.total },
    { kind: "item", kode: "—", nama: "Diskon Penjualan", nilai: -s.diskonPenjualan },
    { kind: "item", kode: "—", nama: "Retur Penjualan", nilai: -s.returPenjualan },
    { kind: "total", text: "Total Pendapatan dari Penjualan", nilai: s.totalPendapatan },
    { kind: "blank" },
    { kind: "header", text: "HARGA POKOK PENJUALAN" },
    ...items(s.hpp.baris),
    { kind: "item", kode: "—", nama: "Diskon Pembelian", nilai: -s.diskonPembelian },
    { kind: "total", text: "Total Harga Pokok Penjualan", nilai: s.totalHpp },
    { kind: "blank" },
    { kind: "total", text: "Laba Kotor", nilai: s.labaKotor },
    { kind: "blank" },
    { kind: "header", text: "BIAYA OPERASIONAL" },
    ...items(s.biayaOperasional.baris),
    { kind: "total", text: "Total Biaya", nilai: s.totalBiayaOperasional },
    { kind: "blank" },
    { kind: "total", text: "Pendapatan Bersih Operasional", nilai: s.operasionalBersih },
    { kind: "blank" },
    { kind: "header", text: "PENDAPATAN LAINNYA" },
    ...items(s.pendapatanLainnya.baris),
    { kind: "total", text: "Total Pendapatan Lainnya", nilai: s.totalPendapatanLainnya },
    { kind: "blank" },
    { kind: "header", text: "BIAYA LAINNYA" },
    ...items(s.biayaLainnya.baris),
    { kind: "total", text: "Total Biaya Lainnya", nilai: s.totalBiayaLainnya },
    { kind: "blank" },
    { kind: "total", text: "Pendapatan Bersih / Laba Bersih", nilai: s.labaBersih },
    { kind: "blank" },
    {
      kind: "total",
      text: "Total Pendapatan Komprehensif untuk Periode Ini",
      nilai: s.totalKomprehensif,
    },
    { kind: "blank" },
    { kind: "sub", text: "Catatan:" },
    ...s.catatan.map((c): DocBaris => ({ kind: "note", text: `- ${c}` })),
  ];
}

export function buildLabaRugiPdf(snapshots: LabaRugiSnapshot[]): Buffer {
  return buildDokumenPdf(snapshots.map(snapshotKeBarisLR));
}

export function snapshotKeSheetLR(s: LabaRugiSnapshot, sheetName: string): XlsxSheet {
  const rows = [
    [{ v: DOKUMEN_PERUSAHAAN, bold: true }],
    [{ v: "Laba Rugi", bold: true }],
    [{ v: s.label }],
    [{ v: "(dalam IDR)" }],
    [],
    [{ v: "Uraian", bold: true }, { v: "Kode", bold: true }, { v: "Nilai (IDR)", bold: true }],
  ] as XlsxSheet["rows"];
  rows.push(...docBarisKeSheetRows(snapshotKeBarisLR(s).slice(5)));
  return { name: sheetName.slice(0, 31), rows };
}

/** Nama file unduhan, ex: Laba_Rugi_PT_Bumi_Surya_Farm_2026-09-30.pdf */
export function labaRugiNamaFile(ext: "pdf" | "xlsx", endIso: string): string {
  return namaFileDokumen("Laba_Rugi_PT_Bumi_Surya_Farm", ext, endIso);
}
