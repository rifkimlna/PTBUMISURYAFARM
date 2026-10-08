// Tipe & konstanta Laporan Jurnal yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/neraca-types.ts.)

export const JURNAL_PERIODE = [
  "hari-ini",
  "minggu-ini",
  "bulan-ini",
  "tahun-ini",
  "kemarin",
  "minggu-lalu",
  "bulan-lalu",
  "tahun-lalu",
  "custom",
] as const;

export type JurnalPeriode = (typeof JURNAL_PERIODE)[number];

export const JURNAL_PERIODE_LABEL: Record<JurnalPeriode, string> = {
  "hari-ini": "Hari ini",
  "minggu-ini": "Minggu ini",
  "bulan-ini": "Bulan ini",
  "tahun-ini": "Tahun ini",
  kemarin: "Kemarin",
  "minggu-lalu": "Minggu lalu",
  "bulan-lalu": "Bulan lalu",
  "tahun-lalu": "Tahun lalu",
  custom: "Custom",
};

export type JurnalLeg = {
  kode: string;
  nama: string;
  debit: number;
  kredit: number;
};

export type JurnalVoucher = {
  id: string;
  noTransaksi: string | null;
  /** ISO tanggal transaksi. */
  tanggal: string;
  uraian: string;
  legs: JurnalLeg[];
  totalDebit: number;
  totalKredit: number;
};

export type JurnalSnapshot = {
  periode: JurnalPeriode;
  start: string;
  end: string;
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  voucher: JurnalVoucher[];
  grandTotalDebit: number;
  grandTotalKredit: number;
  /** Penjelasan sumber data & cakupan. */
  catatan: string[];
};
