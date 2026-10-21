// Tipe & konstanta Laporan Daftar Tukar Faktur yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/proforma-invoice-types.ts.)

export const TUKAR_FAKTUR_PERIODE = [
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

export type TukarFakturPeriode = (typeof TUKAR_FAKTUR_PERIODE)[number];

export const TUKAR_FAKTUR_PERIODE_LABEL: Record<TukarFakturPeriode, string> = {
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

/** Label tampil status tukar faktur (dipetakan dari status dokumen). */
export type StatusTukarFaktur = "Terbuka" | "Selesai" | "Dibatalkan";

export type TukarFakturBaris = {
  id: string;
  tanggal: string;
  noTransaksi: string;
  jatuhTempo: string | null;
  pelanggan: string;
  /** No. faktur/invoice yang dirujuk, dipisah koma. */
  rujukan: string;
  status: StatusTukarFaktur;
  totalRujukan: number;
  sisaRujukan: number;
  mataUang: string;
};

export type TukarFakturSnapshot = {
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  start: string;
  end: string;
  baris: TukarFakturBaris[];
  total: number;
  totalRujukan: number;
  totalSisaRujukan: number;
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

/** Cerminan resolveTukarFakturRange (server) — mengisi otomatis tanggal awal/akhir. */
export function rentangUntukTukarFaktur(
  periode: TukarFakturPeriode,
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
