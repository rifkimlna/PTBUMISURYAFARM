// Tipe & konstanta Laporan Daftar Faktur Proforma yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/jurnal-types.ts.)

export const PROFORMA_PERIODE = [
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

export type ProformaPeriode = (typeof PROFORMA_PERIODE)[number];

export const PROFORMA_PERIODE_LABEL: Record<ProformaPeriode, string> = {
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

/** Label tampil status proforma (dipetakan dari status sistem + tagihan anak). */
export type StatusProforma = "Draft" | "Open" | "Paid" | "Cancelled";

export type ProformaBaris = {
  id: string;
  tanggal: string;
  noTransaksi: string;
  jatuhTempo: string | null;
  pelanggan: string;
  status: StatusProforma;
  total: number;
  sisa: number;
  mataUang: string;
};

export type ProformaSnapshot = {
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  start: string;
  end: string;
  baris: ProformaBaris[];
  total: number;
  totalInvoice: number;
  totalSisa: number;
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

/** Cerminan resolveProformaRange (server) — mengisi otomatis tanggal awal/akhir. */
export function rentangUntukProforma(
  periode: ProformaPeriode,
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
