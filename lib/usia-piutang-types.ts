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

export type KategoriAging =
  | "Belum Jatuh Tempo"
  | "1 - 30 Hari"
  | "31 - 60 Hari"
  | "61 - 90 Hari"
  | "> 90 Hari";

/** Urutan kelompok aging — dipakai tabel, PDF, dan XLSX. */
export const KATEGORI_AGING: readonly KategoriAging[] = [
  "Belum Jatuh Tempo",
  "1 - 30 Hari",
  "31 - 60 Hari",
  "61 - 90 Hari",
  "> 90 Hari",
];

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
  /** Belum jatuh tempo (termasuk jatuh tempo tepat pada tanggal laporan). */
  b0: number;
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
  totalB0: number;
  totalB1: number;
  totalB2: number;
  totalB3: number;
  totalB4: number;
  totalTransaksi: number;
};

// ---------- Perhitungan aging bersama (tabel, PDF, dan XLSX) ----------

export type BucketAging = "b0" | "b1" | "b2" | "b3" | "b4";

/** Indeks hari kalender lokal — bebas jam/zona waktu. */
function indeksHariLokal(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
}

function keTanggal(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

/**
 * Kelompok aging dari umur piutang (hari kalender):
 * - umur <= 0 -> "Belum Jatuh Tempo" (belum jatuh tempo / jatuh tempo tepat hari laporan).
 * - 1–30, 31–60, 61–90, > 90 -> kelompok keterlambatan.
 */
export function kategoriAgingDariUmur(umurHari: number): KategoriAging {
  if (!Number.isFinite(umurHari) || umurHari <= 0) return "Belum Jatuh Tempo";
  if (umurHari <= 30) return "1 - 30 Hari";
  if (umurHari <= 60) return "31 - 60 Hari";
  if (umurHari <= 90) return "61 - 90 Hari";
  return "> 90 Hari";
}

/**
 * Satu fungsi perhitungan aging untuk tabel, PDF, dan XLSX.
 * Umur = tanggal laporan − tanggal jatuh tempo (fallback tanggal invoice bila
 * jatuh tempo kosong), dalam hari kalender.
 */
export function hitungAgingPiutang(input: {
  tanggalLaporan: Date | string;
  jatuhTempo?: Date | string | null;
  tanggalInvoice: Date | string;
}): { umurHari: number; kategori: KategoriAging } {
  const laporan = keTanggal(input.tanggalLaporan);
  const dasar = input.jatuhTempo ? keTanggal(input.jatuhTempo) : keTanggal(input.tanggalInvoice);
  if (Number.isNaN(laporan.getTime()) || Number.isNaN(dasar.getTime())) {
    throw new Error("Tanggal laporan / jatuh tempo tidak valid");
  }
  const umurHari = indeksHariLokal(laporan) - indeksHariLokal(dasar);
  return { umurHari, kategori: kategoriAgingDariUmur(umurHari) };
}

/** Pemetaan kelompok → field bucket (satu sumber untuk semua format). */
export function bucketAging(kategori: KategoriAging): BucketAging {
  switch (kategori) {
    case "Belum Jatuh Tempo":
      return "b0";
    case "1 - 30 Hari":
      return "b1";
    case "31 - 60 Hari":
      return "b2";
    case "61 - 90 Hari":
      return "b3";
    case "> 90 Hari":
      return "b4";
  }
}

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
