// Tipe & konstanta Laporan Penjualan per Produk yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/jurnal-types.ts.)

const PENJUALAN_PER_PRODUK_PERIODE = [
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

type PenjualanPerProdukPeriode = typeof PENJUALAN_PER_PRODUK_PERIODE[number];

const PENJUALAN_PER_PRODUK_PERIODE_LABEL: Record<PenjualanPerProdukPeriode, string> = {
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

type PenjualanBaris = {
  id: string; // product id
  kodeProduk: string;
  namaProduk: string;
  qtyPenjualan: number;
  qtyRetur: number;
  unit: string;
  nilaiPenjualan: number;
  nilaiRetur: number;
  hargaRataRata: number; // nilaiPenjualan / qtyPenjualan (jika qtyPenjualan > 0)
};

type PenjualanPerProdukSnapshot = {
  label: string; // ex: "Periode 1 Januari 2026 - 31 Januari 2026"
  tanggalAwalko: string; // ISO string for start date (if needed)
  tanggalAkhir: string; // ISO string for end date
  baris: PenjualanBaris[];
  totalNilaiPenjualan: number;
  totalNilaiRetur: number;
  totalProduk: number; // count of distinct products
};

// Helper date functions (pure, client-safe)
function startOfDayLokal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDaysLokal(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Akhir periode untuk preset (dipakai mengisi date picker tanggal laporan). */
function akhirUntukPeriode(periode: PenjualanPerProdukPeriode, now = new Date()): Date {
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

/** Awal periode untuk preset. */
function awalUntukPeriode(periode: PenjualanPerProdukPeriode, now = new Date()): Date {
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

function resolvePeriodeTanggal(
  periode: PenjualanPerProdukPeriode,
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
    // Clamp to today if future
    const today = startOfDayLokal(now);
    if (dari > today) dari = today;
    if (sampai > today) sampai = today;
  }
  const label = `Periode ${formatTgl(dari)} - ${formatTgl(sampai)}`;
  return { dari, sampai, label };
}

function formatTgl(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// Export the helper functions for use in server and client
export {
  PENJUALAN_PER_PRODUK_PERIODE,
  PENJUALAN_PER_PRODUK_PERIODE_LABEL,
  awalUntukPeriode,
  akhirUntukPeriode,
  resolvePeriodeTanggal,
};
export type {
  PenjualanPerProdukPeriode,
  PenjualanBaris,
  PenjualanPerProdukSnapshot,
};
