// Adaptor export Laporan Arus Kas di atas builder generik (lib/dokumen-export.ts).
// Struktur: Operasional -> Investasi -> Keuangan -> Kenaikan -> Revaluasi ->
// Saldo Awal -> Saldo Akhir (+ rincian per sumber dana). Data dari snapshot
// yang sama dengan halaman web.

import type { ArusKasSnapshot } from "@/lib/arus-kas-types";
import {
  DOKUMEN_PERUSAHAAN,
  buildDokumenPdf,
  docBarisKeSheetRows,
  namaFileDokumen,
  type DocBaris,
  type XlsxSheet,
} from "@/lib/dokumen-export";

export function snapshotKeBarisAK(s: ArusKasSnapshot): DocBaris[] {
  const aktivitas = (
    judul: string,
    baris: { kode: string; nama: string; nilai: number }[],
    bersihLabel: string,
    bersih: number
  ): DocBaris[] => [
    { kind: "sub", text: judul },
    ...baris.map((b): DocBaris => ({ kind: "item", kode: b.kode, nama: b.nama, nilai: b.nilai })),
    { kind: "total", text: bersihLabel, nilai: bersih },
    { kind: "blank" },
  ];

  return [
    { kind: "header", text: DOKUMEN_PERUSAHAAN },
    { kind: "header", text: "ARUS KAS" },
    { kind: "sub", text: s.label },
    { kind: "sub", text: "(dalam IDR)" },
    { kind: "blank" },
    ...aktivitas(
      s.operasional.judul,
      s.operasional.baris,
      "Arus Kas Bersih dari Aktivitas Operasional",
      s.operasional.bersih
    ),
    ...aktivitas(
      s.investasi.judul,
      s.investasi.baris,
      "Arus Kas Bersih dari Aktivitas Investasi",
      s.investasi.bersih
    ),
    ...aktivitas(
      s.keuangan.judul,
      s.keuangan.baris,
      "Arus Kas Bersih dari Aktivitas Keuangan",
      s.keuangan.bersih
    ),
    { kind: "total", text: "Kenaikan/Penurunan Kas", nilai: s.kenaikan },
    { kind: "blank" },
    { kind: "total", text: "Total Revaluasi Bank", nilai: s.revaluasi },
    { kind: "blank" },
    { kind: "total", text: "Saldo Kas Awal", nilai: s.saldoAwal },
    { kind: "blank" },
    { kind: "sub", text: "Rincian Saldo Kas Awal per Sumber Dana" },
    ...s.saldoAwalPerSumber.map(
      (b): DocBaris => ({ kind: "item", kode: b.kode, nama: `${b.nama} (awal)`, nilai: b.nilai })
    ),
    { kind: "blank" },
    { kind: "total", text: "Saldo Kas Akhir", nilai: s.saldoAkhir },
    { kind: "blank" },
    { kind: "sub", text: "Rincian Saldo Kas Akhir per Sumber Dana" },
    ...s.saldoAkhirPerSumber.map(
      (b): DocBaris => ({ kind: "item", kode: b.kode, nama: `${b.nama} (akhir)`, nilai: b.nilai })
    ),
    { kind: "blank" },
    { kind: "sub", text: "Catatan:" },
    ...s.catatan.map((c): DocBaris => ({ kind: "note", text: `- ${c}` })),
  ];
}

export function buildArusKasPdf(snapshots: ArusKasSnapshot[]): Buffer {
  return buildDokumenPdf(snapshots.map(snapshotKeBarisAK));
}

export function snapshotKeSheetAK(s: ArusKasSnapshot, sheetName: string): XlsxSheet {
  const rows = [
    [{ v: DOKUMEN_PERUSAHAAN, bold: true }],
    [{ v: "Arus Kas", bold: true }],
    [{ v: s.label }],
    [{ v: "(dalam IDR)" }],
    [],
    [{ v: "Uraian", bold: true }, { v: "Kode", bold: true }, { v: "Nilai (IDR)", bold: true }],
  ] as XlsxSheet["rows"];
  rows.push(...docBarisKeSheetRows(snapshotKeBarisAK(s).slice(5)));
  return { name: sheetName.slice(0, 31), rows };
}

/** Nama file unduhan, ex: Arus_Kas_PT_Bumi_Surya_Farm_2026-09-30.pdf */
export function arusKasNamaFile(ext: "pdf" | "xlsx", endIso: string): string {
  return namaFileDokumen("Arus_Kas_PT_Bumi_Surya_Farm", ext, endIso);
}
