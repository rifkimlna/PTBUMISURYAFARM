// Tipe Laporan Ringkasan Stok Produk yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/daftar-produk-types.ts.)
//
// Sumber: master Produk (PersediaanBarang) + RiwayatStok + FakturPembelianItem.
// - Stok per tanggal = stokAwal + Σ(MASUK) - Σ(KELUAR) dari RiwayatStok dengan
//   tanggal <= tanggal laporan — persis seperti perhitungan halaman Produk.
// - Harga rata-rata per unit = hargaRataRataManual bila diisi user; bila kosong
//   pakai rata-rata tertimbang harga faktur pembelian nyata via produkId —
//   sama seperti halaman Produk. Bila tidak ada data harga sama sekali →
//   null (ditampilkan "—"), bukan Rp 0 dan bukan harga karangan.
// - Halaman ini menyegarkan data otomatis (polling + saat tab kembali fokus),
//   sehingga perubahan dari halaman Produk langsung tercermin.
// Tanpa pembagian gudang dan tanpa data dummy.

export type RingkasanStokBaris = {
  /** Kode produk / SKU (id PersediaanBarang, ex: BRG-001). */
  kode: string;
  namaProduk: string;
  satuan: string;
  /** Kuantitas stok per tanggal (boleh 0/negatif). null untuk produk Jasa. */
  stok: number | null;
  /** Harga rata-rata tertimbang per unit; null bila tidak ada data harga. */
  hargaRataRata: number | null;
  /** stok × harga rata-rata; null bila stok atau harga tidak tersedia. */
  totalNilai: number | null;
};

export type RingkasanStokSnapshot = {
  /** Label cetak, ex: "Per 18 Oktober 2026". */
  label: string;
  /** Tanggal laporan (akhir hari, ISO string). */
  tanggal: string;
  baris: RingkasanStokBaris[];
  totalProduk: number;
  /** Jumlah kuantitas stok seluruh produk (Jasa tidak dihitung). */
  totalStok: number;
  /**
   * Jumlah nilai stok dari produk yang nilainya valid (stok × harga rata-rata).
   * Produk tanpa harga rata-rata tidak dihitung sebagai Rp 0.
   * null hanya bila ada produk tetapi tidak ada satu pun nilai valid
   * (tampil "—"); daftar produk kosong menghasilkan Rp 0.
   */
  totalNilai: number | null;
};

/** Label laporan, ex: "Per 18 Oktober 2026". */
export function labelRingkasanStok(tanggal: Date): string {
  return `Per ${tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
}

/** YYYY-MM-DD lokal untuk nilai awal input tanggal. */
export function tanggalYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
