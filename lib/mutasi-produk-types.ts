// Tipe & konstanta Laporan Mutasi Produk yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/penjualan-per-produk-types.ts.)
//
// Mutasi = pergerakan stok per produk yang bersumber dari RiwayatStok saja —
// sumber yang sama dengan perhitungan stok di halaman Produk (stokAwal + MASUK
// - KELUAR). Faktur/penerimaan pembelian dan dokumen penjualan tidak menulis
// RiwayatStok, jadi tidak dihitung agar saldo laporan sama dengan halaman Produk
// dan tidak terjadi penghitungan ganda.

export const MUTASI_PRODUK_PERIODE = [
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

export type MutasiProdukPeriode = typeof MUTASI_PRODUK_PERIODE[number];

export const MUTASI_PRODUK_PERIODE_LABEL: Record<MutasiProdukPeriode, string> = {
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

/** Kategori mutasi menurut asal catatan stok (RiwayatStok.sumber). */
export type JenisMutasi = "PEMBELIAN" | "PENYESUAIAN" | "MANUAL" | "STOK";

export type MutasiProdukBaris = {
  /** Kunci unik baris (stabil untuk key React). */
  id: string;
  /** Tanggal mutasi (ISO string). */
  tanggal: string;
  namaProduk: string;
  jenis: JenisMutasi;
  jenisLabel: string;
  /** Nomor dokumen/faktur, atau keterangan penyesuaian. */
  referensi: string;
  stokMasuk: number;
  stokKeluar: number;
  /** Saldo stok produk setelah mutasi ini (stokAwal + akumulasi mutasi). */
  saldo: number;
};

export type MutasiProdukSnapshot = {
  /** Label cetak, ex: "Periode 1 Oktober 2026 - 31 Oktober 2026". */
  label: string;
  tanggalAwal: string; // ISO string
  tanggalAkhir: string; // ISO string
  baris: MutasiProdukBaris[];
  totalStokMasuk: number;
  totalStokKeluar: number;
  /** Jumlah baris mutasi yang ditampilkan. */
  totalBaris: number;
};

// ----------------------------------------------------------------------------
// Helper periode (murni, aman di client)
// ----------------------------------------------------------------------------

function startOfDayLokal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDaysLokal(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Awal periode untuk preset. */
export function awalUntukPeriode(periode: MutasiProdukPeriode, now = new Date()): Date {
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

/** Akhir periode untuk preset. */
export function akhirUntukPeriode(periode: MutasiProdukPeriode, now = new Date()): Date {
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

function formatTgl(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function resolvePeriodeTanggal(
  periode: MutasiProdukPeriode,
  tanggalAwals?: string,
  tanggalAkhirs?: string
): { dari: Date; sampai: Date; label: string } {
  let dari: Date;
  let sampai: Date;
  if (periode === "custom") {
    if (!tanggalAwals || !tanggalAkhirs) throw new Error("Tanggal awal dan akhir wajib diisi");
    dari = startOfDayLokal(new Date(tanggalAwals));
    sampai = startOfDayLokal(new Date(tanggalAkhirs));
    if (Number.isNaN(dari.getTime()) || Number.isNaN(sampai.getTime()))
      throw new Error("Tanggal tidak valid");
    if (dari > sampai) throw new Error("Tanggal awal tidak boleh lebih besar dari tanggal akhir");
  } else {
    const now = new Date();
    dari = startOfDayLokal(awalUntukPeriode(periode));
    sampai = startOfDayLokal(akhirUntukPeriode(periode));
    const today = startOfDayLokal(now);
    if (dari > today) dari = today;
    if (sampai > today) sampai = today;
  }
  const label = `Periode ${formatTgl(dari)} - ${formatTgl(sampai)}`;
  return { dari, sampai, label };
}
