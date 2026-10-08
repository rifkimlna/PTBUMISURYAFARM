// Tipe & konstanta Laporan Pengiriman Penjualan yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/jurnal-types.ts.)

export const PENGIRIMAN_PENJUALAN_PERIODE = [
  "hari-ini",
  "minggu-ini",
  "bulan-ini",
  "tahun-ini",
  "kemarin",
  "minggu-lalu",
  "bulan-lalu",
  "tahun-lalu",
  "custom",
] as const;

export type PengirimanPenjualanPeriode = (typeof PENGIRIMAN_PENJUALAN_PERIODE)[number];

export const PENGIRIMAN_PENJUALAN_PERIODE_LABEL: Record<PengirimanPenjualanPeriode, string> = {
  "hari-ini": "Hari ini",
  "minggu-ini": "Minggu ini",
  "bulan-ini": "Bulan ini",
  "tahun-ini": "Tahun ini",
  kemarin: "Kemarin",
  "minggu-lalu": "Minggu lalu",
  "bulan-lalu": "Bulan lalu",
  "tahun-lalu": "Tahun lalu",
  custom: "Custom",
};

export type PengirimanItemBaris = {
  id: string;
  kode: string;
  nama: string;
  unit: string;
  qty: number;
  jumlah: number;
};

export type PengirimanGrup = {
  pelanggan: string;
  baris: PengirimanItemBaris[];
  totalQty: number;
  totalJumlah: number;
};

export type PengirimanPenjualanSnapshot = {
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  start: string;
  end: string;
  grup: PengirimanGrup[];
  grandQty: number;
  grandJumlah: number;
  totalBaris: number;
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

/** Cerminan resolvePengirimanRange (server) — mengisi otomatis tanggal awal/akhir. */
export function rentangUntukPengiriman(
  periode: PengirimanPenjualanPeriode,
  now = new Date()
): { dari: string; sampai: string } | null {
  const today = startOfDayLokal(now);
  switch (periode) {
    case "hari-ini":
      return { dari: toYMDLokal(today), sampai: toYMDLokal(today) };
    case "kemarin": {
      const y = addDaysLokal(today, -1);
      return { dari: toYMDLokal(y), sampai: toYMDLokal(y) };
    }
    case "minggu-ini": {
      const dow = (today.getDay() + 6) % 7;
      return { dari: toYMDLokal(addDaysLokal(today, -dow)), sampai: toYMDLokal(addDaysLokal(today, -dow + 6)) };
    }
    case "minggu-lalu": {
      const dow = (today.getDay() + 6) % 7;
      return { dari: toYMDLokal(addDaysLokal(today, -dow - 7)), sampai: toYMDLokal(addDaysLokal(today, -dow - 7 + 6)) };
    }
    case "bulan-ini":
      return { dari: toYMDLokal(new Date(now.getFullYear(), now.getMonth(), 1)), sampai: toYMDLokal(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case "bulan-lalu":
      return { dari: toYMDLokal(new Date(now.getFullYear(), now.getMonth() - 1, 1)), sampai: toYMDLokal(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "tahun-ini":
      return { dari: toYMDLokal(new Date(now.getFullYear(), 0, 1)), sampai: toYMDLokal(new Date(now.getFullYear(), 11, 31)) };
    case "tahun-lalu":
      return { dari: toYMDLokal(new Date(now.getFullYear() - 1, 0, 1)), sampai: toYMDLokal(new Date(now.getFullYear() - 1, 11, 31)) };
    default:
      return null;
  }
}
