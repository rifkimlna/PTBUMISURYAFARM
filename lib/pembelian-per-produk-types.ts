// Tipe & konstanta Laporan Pembelian per Produk yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/penjualan-per-produk-types.ts.)
// Rekap per produk dari Faktur Pembelian (pembelian) dan Tukar Faktur pembelian
// (retur) yang benar-benar tercatat; tanpa dummy.

export const PEMBELIAN_PER_PRODUK_PERIODE = [
  "hari-ini",
  "minggu-ini",
  "bulan-ini",
  "kuartal-ini",
  "tahun-ini",
  "kemarin",
  "minggu-lalu",
  "bulan-lalu",
  "kuartal-lalu",
  "tahun-lalu",
  "custom",
] as const;

export type PembelianPerProdukPeriode = (typeof PEMBELIAN_PER_PRODUK_PERIODE)[number];

export const PEMBELIAN_PER_PRODUK_PERIODE_LABEL: Record<PembelianPerProdukPeriode, string> = {
  "hari-ini": "Hari ini",
  "minggu-ini": "Minggu ini",
  "bulan-ini": "Bulan ini",
  "kuartal-ini": "Kuartal ini",
  "tahun-ini": "Tahun ini",
  kemarin: "Kemarin",
  "minggu-lalu": "Minggu lalu",
  "bulan-lalu": "Bulan lalu",
  "kuartal-lalu": "Kuartal lalu",
  "tahun-lalu": "Tahun lalu",
  custom: "Custom",
};

export type PembelianPerProdukBaris = {
  /** Kunci grup unik (id:… / teks:…) agar key React tidak kembar. */
  id: string;
  /** Kode produk / SKU (produkId PersediaanBarang) atau "—" untuk item manual. */
  kodeProduk: string;
  namaProduk: string;
  qtyPembelian: number;
  qtyRetur: number;
  unit: string;
  nilaiPembelian: number;
  nilaiRetur: number;
  /** Nilai pembelian / qty pembelian (jika qty pembelian > 0). */
  hargaRataRata: number;
};

export type PembelianPerProdukSnapshot = {
  /** Label rentang, ex: "Periode 1 – 30 September 2026". */
  label: string;
  start: string;
  end: string;
  baris: PembelianPerProdukBaris[];
  totalNilaiPembelian: number;
  totalNilaiRetur: number;
  totalProduk: number;
};

// ---------- Helper tanggal murni (aman untuk Client Component) ----------

function toYMDLokal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDayLokal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDaysLokal(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Awal periode untuk preset (dipakai mengisi date picker tanggal awal). */
export function awalUntukPembelianPerProduk(periode: PembelianPerProdukPeriode, now = new Date()): Date {
  const today = startOfDayLokal(now);
  switch (periode) {
    case "hari-ini":
      return today;
    case "kemarin":
      return addDaysLokal(today, -1);
    case "minggu-ini": {
      const dow = (today.getDay() + 6) % 7;
      return addDaysLokal(today, -dow);
    }
    case "minggu-lalu": {
      const dow = (today.getDay() + 6) % 7;
      return addDaysLokal(today, -dow - 7);
    }
    case "bulan-ini":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "bulan-lalu":
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case "kuartal-ini": {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3, 1);
    }
    case "kuartal-lalu": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      return new Date(now.getFullYear(), q * 3, 1);
    }
    case "tahun-ini":
      return new Date(now.getFullYear(), 0, 1);
    case "tahun-lalu":
      return new Date(now.getFullYear() - 1, 0, 1);
    case "custom":
      return today;
  }
}

/** Akhir periode untuk preset (dipakai mengisi date picker tanggal akhir). */
export function akhirUntukPembelianPerProduk(periode: PembelianPerProdukPeriode, now = new Date()): Date {
  const today = startOfDayLokal(now);
  switch (periode) {
    case "hari-ini":
      return today;
    case "kemarin":
      return addDaysLokal(today, -1);
    case "minggu-ini": {
      const dow = (today.getDay() + 6) % 7;
      return addDaysLokal(today, -dow + 6);
    }
    case "minggu-lalu": {
      const dow = (today.getDay() + 6) % 7;
      return addDaysLokal(today, -dow - 1);
    }
    case "bulan-ini":
      return new Date(now.getFullYear(), now.getMonth() + 1, 0);
    case "bulan-lalu":
      return new Date(now.getFullYear(), now.getMonth(), 0);
    case "kuartal-ini": {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3 + 3, 0);
    }
    case "kuartal-lalu": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      return new Date(now.getFullYear(), q * 3 + 3, 0);
    }
    case "tahun-ini":
      return new Date(now.getFullYear(), 11, 31);
    case "tahun-lalu":
      return new Date(now.getFullYear() - 1, 11, 31);
    case "custom":
      return today;
  }
}

/** Rentang siap pakai untuk mengisi date picker periode preset. */
export function rentangUntukPembelianPerProduk(
  periode: PembelianPerProdukPeriode,
  now = new Date()
): { dari: string; sampai: string } | null {
  if (periode === "custom") return null;
  return {
    dari: toYMDLokal(awalUntukPembelianPerProduk(periode, now)),
    sampai: toYMDLokal(akhirUntukPembelianPerProduk(periode, now)),
  };
}
