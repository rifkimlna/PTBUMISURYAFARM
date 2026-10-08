// Tipe & konstanta Laporan Perubahan Modal yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/neraca-types.ts.)

export const PERUBAHAN_MODAL_PERIODE = [
  "tanggal",
  "hari-ini",
  "minggu-ini",
  "bulan-ini",
  "tahun-ini",
  "kemarin",
  "minggu-lalu",
  "bulan-lalu",
  "tahun-lalu",
] as const;

export type PerubahanModalPeriode = (typeof PERUBAHAN_MODAL_PERIODE)[number];

export const PERUBAHAN_MODAL_PERIODE_LABEL: Record<PerubahanModalPeriode, string> = {
  tanggal: "Tanggal",
  "hari-ini": "Hari ini",
  "minggu-ini": "Minggu ini",
  "bulan-ini": "Bulan ini",
  "tahun-ini": "Tahun ini",
  kemarin: "Kemarin",
  "minggu-lalu": "Minggu lalu",
  "bulan-lalu": "Bulan lalu",
  "tahun-lalu": "Tahun lalu",
};

export type PerubahanModalBaris = {
  kode: string;
  nama: string;
  /** Saldo kumulatif s/d sehari sebelum periode. */
  permulaan: number;
  /** Mutasi debit (pengurang) dalam periode. */
  debit: number;
  /** Mutasi kredit (penambah) dalam periode. */
  kredit: number;
  /** Permulaan + Kredit − Debit. */
  saldoAkhir: number;
  /** Kredit − Debit. */
  pergerakan: number;
};

export type PerubahanModalSnapshot = {
  periode: PerubahanModalPeriode;
  /** Batas awal periode (waktu setempat). */
  start: string;
  /** Batas akhir periode (waktu setempat). */
  end: string;
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  baris: PerubahanModalBaris[];
  totalPermulaan: number;
  totalDebit: number;
  totalKredit: number;
  totalSaldoAkhir: number;
  /** TotalKredit − TotalDebit (sama dengan TotalSaldoAkhir − TotalPermulaan). */
  totalPergerakan: number;
  /** Penjelasan sumber data. */
  catatan: string[];
};
