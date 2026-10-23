// Tipe & konstanta Laporan Daftar Pembelian yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/daftar-penjualan-types.ts.)

export const DAFTAR_PEMBELIAN_PERIODE = [
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

export type DaftarPembelianPeriode = (typeof DAFTAR_PEMBELIAN_PERIODE)[number];

export const DAFTAR_PEMBELIAN_PERIODE_LABEL: Record<DaftarPembelianPeriode, string> = {
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

export const DAFTAR_PEMBELIAN_TIPE = ["Faktur Pembelian"] as const;
export type DaftarPembelianTipe = (typeof DAFTAR_PEMBELIAN_TIPE)[number];

export type StatusPembayaranPembelian = "Belum Dibayar" | "Sebagian Dibayar" | "Sudah Dibayar";

export type DaftarPembelianBaris = {
  id: string;
  tanggal: string;
  tipeTransaksi: string;
  noTransaksi: string;
  supplier: string;
  status: StatusPembayaranPembelian;
  memo: string;
  total: number;
  sisa: number;
};

export type DaftarPembelianSnapshot = {
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  start: string;
  end: string;
  baris: DaftarPembelianBaris[];
  total: number;
  totalTransaksi: number;
  totalSisa: number;
};

export type DaftarPembelianFilter = {
  periode: DaftarPembelianPeriode;
  dari: string;
  sampai: string;
  supplier: string;
  status: string;
  tipe: string;
  page: number;
  limit: number;
};
