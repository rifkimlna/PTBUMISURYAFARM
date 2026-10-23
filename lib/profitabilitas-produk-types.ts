// Tipe & filter Laporan Profitabilitas Produk yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/proforma-invoice-types.ts.)

export type ProfitabilitasFilter = {
  /** YYYY-MM-DD */
  dari: string;
  /** YYYY-MM-DD */
  sampai: string;
  /** Saring nama produk (contains, tak sensitif huruf). */
  produk: string;
  /** Saring kategori master Produk (persis). Kosong = semua. */
  kategori: string;
};

export type ProfitabilitasBaris = {
  /** Kunci grup unik (id:<produkId> / teks:<deskripsi>), juga dipakai key React. */
  id: string;
  namaProduk: string;
  qtyTerjual: number;
  satuan: string;
  nilaiPenjualan: number;
  totalHpp: number;
  profit: number;
  /** Persen, ex: 100 berarti 100%. */
  marginPersen: number;
  hargaJualRata: number;
  hargaBeliRata: number;
  /** Kategori master Produk; "—" bila item ketikan manual. */
  kategori: string;
};

export type ProfitabilitasSnapshot = {
  /** Label rentang untuk kop laporan, ex: "15 Oktober 2026". */
  label: string;
  dari: string;
  sampai: string;
  baris: ProfitabilitasBaris[];
  total: number;
  totalQty: number;
  totalPenjualan: number;
  totalHpp: number;
  totalProfit: number;
  /** Margin dari total (bukan rata-rata margin). */
  marginTotalPersen: number;
};

// ---------- Helper tanggal murni (aman untuk Client Component) ----------

export function todayYMDLokal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Label Indonesia, ex: "15 Oktober 2026" / "1 – 31 Oktober 2026". */
export function labelRentang(dariYMD: string, sampaiYMD: string): string {
  const fmt = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    if (!y || !m || !d) return ymd;
    return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  const a = fmt(dariYMD);
  const b = fmt(sampaiYMD);
  return a === b ? a : `${a} – ${b}`;
}
