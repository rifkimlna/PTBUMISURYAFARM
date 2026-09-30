// Tipe & konstanta Laporan Laba Rugi yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/neraca-types.ts.)

export const LABA_RUGI_PERIODE = [
  "hari-ini",
  "minggu-ini",
  "bulan-ini",
  "triwulan-ini",
  "tahun-ini",
  "bulan-lalu",
  "tahun-lalu",
  "per-bulan-tahun-ini",
  "custom",
] as const;

export type LabaRugiPeriode = (typeof LABA_RUGI_PERIODE)[number];

export const LABA_RUGI_PERIODE_LABEL: Record<LabaRugiPeriode, string> = {
  "hari-ini": "Hari ini",
  "minggu-ini": "Minggu ini",
  "bulan-ini": "Bulan ini",
  "triwulan-ini": "Triwulan ini",
  "tahun-ini": "Tahun ini",
  "bulan-lalu": "Bulan lalu",
  "tahun-lalu": "Tahun lalu",
  "per-bulan-tahun-ini": "Per bulan tahun ini",
  custom: "Custom",
};

export type LabaRugiBaris = { kode: string; nama: string; nilai: number };
export type LabaRugiKelompok = { judul: string; baris: LabaRugiBaris[]; total: number };

export type LabaRugiSnapshot = {
  periode: LabaRugiPeriode;
  start: string;
  end: string;
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  penjualan: LabaRugiKelompok;
  diskonPenjualan: number;
  returPenjualan: number;
  totalPendapatan: number;
  hpp: LabaRugiKelompok;
  diskonPembelian: number;
  totalHpp: number;
  labaKotor: number;
  biayaOperasional: LabaRugiKelompok;
  totalBiayaOperasional: number;
  operasionalBersih: number;
  pendapatanLainnya: LabaRugiKelompok;
  totalPendapatanLainnya: number;
  biayaLainnya: LabaRugiKelompok;
  totalBiayaLainnya: number;
  labaBersih: number;
  totalKomprehensif: number;
  /** Penjelasan bagian yang belum didukung data. */
  catatan: string[];
};
