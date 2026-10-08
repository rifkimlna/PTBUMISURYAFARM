// Tipe & konstanta Laporan Buku Besar yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/neraca-types.ts.)

export const BUKU_BESAR_PERIODE = [
  "hari-ini",
  "minggu-ini",
  "bulan-ini",
  "triwulan-ini",
  "tahun-ini",
  "kemarin",
  "bulan-lalu",
  "kuartal-lalu",
  "tahun-lalu",
  "per-bulan-tahun-ini",
  "custom",
] as const;

export type BukuBesarPeriode = (typeof BUKU_BESAR_PERIODE)[number];

export const BUKU_BESAR_PERIODE_LABEL: Record<BukuBesarPeriode, string> = {
  "hari-ini": "Hari ini",
  "minggu-ini": "Mingguan",
  "bulan-ini": "Bulanan",
  "triwulan-ini": "Triwulanan",
  "tahun-ini": "Tahunan",
  kemarin: "Kemarin",
  "bulan-lalu": "Bulan lalu",
  "kuartal-lalu": "Kuartal lalu",
  "tahun-lalu": "Tahun lalu",
  "per-bulan-tahun-ini": "Per bulan tahun ini",
  custom: "Custom",
};

export type BukuBesarBaris = {
  /** ISO tanggal transaksi. */
  tanggal: string;
  /** Label transaksi asli (kategori / tipe transfer), ex: "Pendapatan Penjualan" / "Transfer (KAS → BANK)". */
  transaksi: string;
  uraian: string;
  noTransaksi: string | null;
  /** Keterangan asli dari TransaksiKas (tanpa dummy). */
  keterangan: string | null;
  debit: number;
  kredit: number;
  /** Saldo berjalan setelah baris ini (current balance per baris). */
  saldo: number;
};

export type BukuBesarAkun = {
  kode: string;
  nama: string;
  kelompok: string;
  golongan: string;
  /** Debit-normal (Aset/Beban) atau kredit-normal. */
  saldoNormal: "debit" | "kredit";
  saldoAwal: number;
  baris: BukuBesarBaris[];
  totalDebit: number;
  totalKredit: number;
  saldoAkhir: number;
};

export type BukuBesarSnapshot = {
  periode: BukuBesarPeriode;
  start: string;
  end: string;
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  /** Filter akun yang dipakai ("semua" bila tanpa filter). */
  akunFilter: string;
  akun: BukuBesarAkun[];
  totalDebit: number;
  totalKredit: number;
  /** Penjelasan sumber data & cakupan. */
  catatan: string[];
};
