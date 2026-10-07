// Tipe & konstanta Laporan Usia Piutang yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/jurnal-types.ts.)
// Umur = tanggal laporan − tanggal jatuh tempo invoice (fallback tanggal invoice).

export const USIA_PIUTANG_PERIODE = [
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

export type UsiaPiutangPeriode = (typeof USIA_PIUTANG_PERIODE)[number];

export const USIA_PIUTANG_PERIODE_LABEL: Record<UsiaPiutangPeriode, string> = {
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

export type KategoriAging = "1 - 30 Hari" | "31 - 60 Hari" | "61 - 90 Hari" | "> 90 Hari";

export type UsiaBaris = {
  id: string;
  tanggal: string;
  transaksi: string;
  no: string;
  deskripsi: string;
  jumlah: number;
  sisa: number;
  umurHari: number;
  kategori: KategoriAging;
};

export type UsiaGrup = {
  pelanggan: string;
  baris: UsiaBaris[];
  total: number;
  b1: number;
  b2: number;
  b3: number;
  b4: number;
};

export type UsiaPiutangSnapshot = {
  /** Label posisi, ex: "Per 30 September 2026". */
  label: string;
  tanggal: string;
  grup: UsiaGrup[];
  total: number;
  totalB1: number;
  totalB2: number;
  totalB3: number;
  totalB4: number;
  totalTransaksi: number;
};

// ---------- Helper tanggal murni (aman untuk Client Component) ----------

function startOfDayLokal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDaysLokal(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Akhir periode untuk preset (dipakai mengisi date picker tanggal laporan). */
export function akhirUntukUsia(periode: UsiaPiutangPeriode, now = new Date()): Date {
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
