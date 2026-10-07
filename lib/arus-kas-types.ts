// Tipe & konstanta Laporan Arus Kas yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/neraca-types.ts.)

export const ARUS_KAS_PERIODE = [
  "hari-ini",
  "minggu-ini",
  "bulan-ini",
  "tahun-ini",
  "bulan-lalu",
  "tahun-lalu",
  "per-bulan-tahun-ini",
  "custom",
] as const;

export type ArusKasPeriode = (typeof ARUS_KAS_PERIODE)[number];

export const ARUS_KAS_PERIODE_LABEL: Record<ArusKasPeriode, string> = {
  "hari-ini": "Hari Ini",
  "minggu-ini": "Mingguan",
  "bulan-ini": "Bulanan",
  "tahun-ini": "Tahunan",
  "bulan-lalu": "Bulan Lalu",
  "tahun-lalu": "Tahun Lalu",
  "per-bulan-tahun-ini": "Per bulan tahun ini",
  custom: "Custom",
};

export type ArusKasBaris = { kode: string; nama: string; nilai: number };
export type ArusKasKelompok = { judul: string; baris: ArusKasBaris[]; masuk: number; keluar: number; bersih: number };

export type SaldoSumber = { sumber: string; kode: string; nama: string; nilai: number };

export type ArusKasSnapshot = {
  periode: ArusKasPeriode;
  start: string;
  end: string;
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  operasional: ArusKasKelompok;
  investasi: ArusKasKelompok;
  keuangan: ArusKasKelompok;
  totalMasuk: number;
  totalKeluar: number;
  kenaikan: number;
  revaluasi: number;
  saldoAwal: number;
  saldoAwalPerSumber: SaldoSumber[];
  saldoAkhir: number;
  saldoAkhirPerSumber: SaldoSumber[];
  /** Penjelasan bagian yang belum didukung data. */
  catatan: string[];
};
