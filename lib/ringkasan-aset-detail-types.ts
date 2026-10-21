// Tipe & konstanta Laporan Detail Aset Tetap (aman untuk Client Component).
// Tanpa impor server/prisma. Reuse helper periode dari ringkasan-aset-types.
//
// Laporan ini menunjukkan riwayat transaksi per aset tetap dalam rentang tanggal:
// - Hanya transaksi nyata dari database (TransaksiKas / Tagihan terkait aset).
// - Penyusutan hanya informatif, belum dijurnal -> ditampilkan sebagai catatan,
//   bukan sebagai baris jurnal aktual.
// - Pelepasan dicatat di master aset (tanpa jurnal otomatis) -> ditampilkan
//   sebagai baris informatif dengan "-" pada Debit/Kredit.
// - Setiap aset adalah grup yang dapat dibuka/ditutup; subtotal per aset dan
//   total keseluruhan ditampilkan di bawah.
// Tidak ada data dummy dan tidak membuat jurnal otomatis.

import {
  RINGKASAN_ASET_PERIODE,
  RINGKASAN_ASET_PERIODE_LABEL,
  type RingkasanAsetPeriode,
  awalUntukRingkasanAset,
  akhirUntukRingkasanAset,
  toYMDPendek,
  resolveRingkasanAsetPeriode,
} from "@/lib/ringkasan-aset-types";

export type TindakanAset = "AKUISISI" | "PENYUSUTAN" | "PELEPASAN";

export type DetailAsetBaris = {
  /** Tanggal transaksi (ISO). */
  tanggal: string | null;
  /** Tindakan: AKUISISI | PENYUSUTAN | PELEPASAN. */
  tindakan: TindakanAset;
  /** Keterangan transaksi. */
  transaksi: string;
  /** Nomor dokumen / nomor aset / "-" bila tidak tersedia. */
  nomor: string;
  /** Kode akun COA (untuk baris jurnal) atau "-" bila informatif. */
  nomorAkun: string;
  /** Nama akun COA atau "-" bila informatif. */
  namaAkun: string;
  /** Debit (Rupiah). */
  debit: number;
  /** Kredit (Rupiah). */
  kredit: number;
  /** Nilai buku setelah baris ini (Rupiah). */
  nilaiBuku: number;
  /** true bila baris ini informatif (bukan jurnal aktual di database). */
  isInformational: boolean;
};

export type DetailAsetGrup = {
  kode: string; // aset.id (ex: AST-001)
  nama: string; // aset.namaAset
  kategori: string;
  akunAset: string | null;
  tanggalAkuisisi: string | null;
  biayaAkuisisi: number;
  statusAset: string;
  tanggalLepas: string | null;
  caraLepas: string | null;
  hargaJual: number | null;
  statusPembayaran: string | null;
  akunPenerima: string | null;
  untungRugi: number | null;
  baris: DetailAsetBaris[];
  subtotalDebit: number;
  subtotalKredit: number;
  saldoAkhir: number;
};

export type DetailAsetSnapshot = {
  periode: RingkasanAsetPeriode;
  start: string;
  end: string;
  label: string;
  grup: DetailAsetGrup[];
  totalAset: number;
  totalDebit: number;
  totalKredit: number;
  totalSaldoAkhir: number;
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
