// Tipe & konstanta Laporan Penjualan/Pelepasan Aset Tetap (aman untuk Client Component).
// Tanpa impor server/prisma. Reuse helper periode dari ringkasan-aset-types.
//
// Laporan ini menunjukkan riwayat penjualan/pelepasan aset tetap dalam rentang tanggal:
// - Hanya aset dengan status DIJUAL atau DILEPAS yang memiliki tanggal lepas.
// - Tanggal ayar digunakan untuk filter tanggal pelepasan.
// - Setiap baris mewakili satu aset yang dijual/dilepas.
// - Kelompokkan berdasarkan akun aset, dengan subtotal dan grand total.
// - Tidak ada data dummy dan tidak membuat jurnal otomatis.

import {
  RINGKASAN_ASET_PERIODE,
  RINGKASAN_ASET_PERIODE_LABEL,
  type RingkasanAsetPeriode,
  awalUntukRingkasanAset,
  akhirUntukRingkasanAset,
  toYMDPendek,
  resolveRingkasanAsetPeriode,
} from "@/lib/ringkasan-aset-types";

export type StatusPelepasan = "SUDAH_DIBAYAR" | "BELUM_DIBAYAR" | "BELUM_DIKONFIRMASI";

export type JenisPelepasan = "DIJUAL" | "DILEPAS";

export type PenjualanPelepasanBaris = {
  /** Nomor aset (id Aset, ex: AST-001). */
  nomorAset: string;
  /** Nama aset. */
  namaAset: string;
  /** Kategori aset. */
  kategori: string;
  /** Kode akun aset tetap. */
  akunAset: string;
  /** Nama akun aset. */
  akunNama: string;
  /** Tanggal akuisisi aset. */
  tanggalAkuisisi: string | null;
  /** Tanggal pelepasan aset. */
  tanggalPelepasan: string | null;
  /** Biaya awal (biaya akuisisi). */
  biayaAwal: number;
  /** Akumulasi penyusutan s/d tanggal pelepasan. */
  akumulasiPenyusutan: number;
  /** Nilai buku pada tanggal pelepasan (Biaya Awal - Akumulasi). */
  nilaiBuku: number;
  /** Harga jual aset (0 jika Dilepas Tanpa Penjualan). */
  hargaJual: number;
  /** Untung/Rugi = Harga Jual - Nilai Buku. */
  untungRugi: number;
  /** Jenis pelepasan: DIJUAL atau DILEPAS. */
  jenisPelepasan: JenisPelepasan;
  /** Status pembayaran: SUDAH_DIBAYAR / BELUM_DIBAYAR / BELUM_DIKONFIRMASI. */
  statusPembayaran: StatusPelepasan | null;
  /** Label status gabungan untuk tampilan. */
  statusLabel: string;
  /** Akun penerima (Kas/Bank/Tabungan) untuk Sudah Dibayar, atau 1102 Piutang untuk Belum Dibayar, atau "-". */
  akunPenerima: string;
  /** Nama akun penerima/piutang. */
  akunPenerimaNama: string;
  /** Nomor transaksi pelepasan. */
  nomorTransaksi: string | null;
};

export type PenjualanPelepasanKelompok = {
  /** Kode akun aset. */
  kode: string;
  /** Nama akun aset. */
  nama: string;
  baris: PenjualanPelepasanBaris[];
  subtotalBiayaAwal: number;
  subtotalAkumulasiPenyusutan: number;
  subtotalNilaiBuku: number;
  subtotalHargaJual: number;
  subtotalUntungRugi: number;
};

export type PenjualanPelepasanSnapshot = {
  periode: RingkasanAsetPeriode;
  /** Awal periode (ISO). */
  start: string;
  /** Tanggal akhir periode, akhir hari (ISO). */
  end: string;
  /** Label cetak, ex: "Periode 1 Oktober 2026 - 31 Oktober 2026". */
  label: string;
  kelompok: PenjualanPelepasanKelompok[];
  totalAset: number;
  totalBiayaAwal: number;
  totalAkumulasiPenyusutan: number;
  totalNilaiBuku: number;
  totalHargaJual: number;
  totalUntungRugi: number;
  catatan: string[];
};

export {
  RINGKASAN_ASET_PERIODE,
  RINGKASAN_ASET_PERIODE_LABEL,
  type RingkasanAsetPeriode,
  awalUntukRingkasanAset,
  akhirUntukRingkasanAset,
  toYMDPendek,
  resolveRingkasanAsetPeriode,
};
