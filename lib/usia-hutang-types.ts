// Tipe & konstanta Laporan Usia Hutang Pembelian yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/usia-piutang-types.ts.)
// Umur = tanggal acuan − tanggal jatuh tempo faktur (fallback tanggal faktur).
// Mengikuti logika aging Mekari: hanya hutang pembelian yang belum lunas.

export const USIA_HUTANG_PERIODE = [
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

export type UsiaHutangPeriode = (typeof USIA_HUTANG_PERIODE)[number];

export const USIA_HUTANG_PERIODE_LABEL: Record<UsiaHutangPeriode, string> = {
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

export type KategoriAgingHutang = "1 - 30 Hari" | "31 - 60 Hari" | "61 - 90 Hari" | "> 90 Hari";

/** Pilihan filter lanjutan kelompok umur ("" = semua). */
export const USIA_HUTANG_KATEGORI: KategoriAgingHutang[] = [
  "1 - 30 Hari",
  "31 - 60 Hari",
  "61 - 90 Hari",
  "> 90 Hari",
];

export type UsiaHutangBaris = {
  id: string;
  tanggal: string;
  transaksi: string;
  no: string;
  deskripsi: string;
  /** ISO tanggal jatuh tempo faktur; null bila tidak diisi. */
  jatuhTempo: string | null;
  jumlah: number;
  sisa: number;
  umurHari: number;
  kategori: KategoriAgingHutang;
};

export type UsiaHutangGrup = {
  supplier: string;
  baris: UsiaHutangBaris[];
  total: number;
  b1: number;
  b2: number;
  b3: number;
  b4: number;
};

export type UsiaHutangSnapshot = {
  /** Label posisi, ex: "Per 30 September 2026". */
  label: string;
  /** ISO tanggal acuan (akhir periode). */
  tanggal: string;
  grup: UsiaHutangGrup[];
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

/** Akhir periode untuk preset (dipakai mengisi date picker tanggal acuan). */
export function akhirUntukUsiaHutang(periode: UsiaHutangPeriode, now = new Date()): Date {
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
