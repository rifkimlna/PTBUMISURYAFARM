// Tipe Laporan Daftar Produk yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/pembelian-per-produk-types.ts.)
// Data berasal dari master Produk (PersediaanBarang + RiwayatStok) yang
// terintegrasi dengan Penjualan dan Pembelian; tanpa dummy dan tanpa pembagian
// stok per gudang.

export type DaftarProdukBaris = {
  /** Kode produk / SKU (id PersediaanBarang, ex: BRG-001). */
  kode: string;
  namaProduk: string;
  satuan: string;
  /** Stok aktual (boleh 0 atau negatif, apa adanya). null untuk produk Jasa. */
  totalStok: number | null;
  batasMinimum: number;
  hargaBeli: number | null;
  hargaJual: number | null;
};

export type DaftarProdukSnapshot = {
  /** Label cetak, ex: "Per 18 Oktober 2026". */
  label: string;
  /** Kata kunci pencarian yang diterapkan (kosong = semua produk). */
  cari: string;
  baris: DaftarProdukBaris[];
  totalProduk: number;
};
