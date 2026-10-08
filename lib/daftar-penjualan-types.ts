// Tipe & konstanta Laporan Daftar Penjualan yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/jurnal-types.ts.)

export const DAFTAR_PENJUALAN_PERIODE = [
  "hari-ini",
  "pekan-ini",
  "bulan-ini",
  "kuartal-ini",
  "tahun-ini",
  "kemarin",
  "pekan-lalu",
  "bulan-lalu",
  "kuartal-lalu",
  "tahun-lalu",
  "custom",
] as const;

export type DaftarPenjualanPeriode = (typeof DAFTAR_PENJUALAN_PERIODE)[number];

export const DAFTAR_PENJUALAN_PERIODE_LABEL: Record<DaftarPenjualanPeriode, string> = {
  "hari-ini": "Hari ini",
  "pekan-ini": "Pekan ini",
  "bulan-ini": "Bulan ini",
  "kuartal-ini": "Kuartal ini",
  "tahun-ini": "Tahun ini",
  kemarin: "Kemarin",
  "pekan-lalu": "Pekan lalu",
  "bulan-lalu": "Bulan lalu",
  "kuartal-lalu": "Kuartal lalu",
  "tahun-lalu": "Tahun lalu",
  custom: "Custom",
};

export type StatusPembayaranPenjualan = "Belum Dibayar" | "Sebagian Dibayar" | "Sudah Dibayar";

export type DaftarPenjualanBaris = {
  id: string;
  tanggal: string;
  tipeTransaksi: string;
  noTransaksi: string;
  pelanggan: string;
  status: StatusPembayaranPenjualan;
  memo: string;
  total: number;
  sisa: number;
};

export type DaftarPenjualanSnapshot = {
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  start: string;
  end: string;
  baris: DaftarPenjualanBaris[];
  total: number;
  totalTransaksi: number;
  totalSisa: number;
};

export type DaftarPenjualanFilter = {
  periode: DaftarPenjualanPeriode;
  dari: string;
  sampai: string;
  page: number;
  limit: number;
};
