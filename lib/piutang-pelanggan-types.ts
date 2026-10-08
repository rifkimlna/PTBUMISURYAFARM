// Tipe & konstanta Laporan Piutang Pelanggan yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/jurnal-types.ts.)
// Laporan posisi "per tanggal": sisa = jumlah invoice − pembayaran s/d tanggal itu.

export const PIUTANG_PELANGGAN_PERIODE = [
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

export type PiutangPelangganPeriode = (typeof PIUTANG_PELANGGAN_PERIODE)[number];

export const PIUTANG_PELANGGAN_PERIODE_LABEL: Record<PiutangPelangganPeriode, string> = {
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

export type PiutangBaris = {
  id: string;
  tanggal: string;
  transaksi: string;
  no: string;
  deskripsi: string;
  /** ISO tanggal jatuh tempo invoice; null bila tidak diisi. */
  jatuhTempo: string | null;
  jumlah: number;
  sisa: number;
};

export type PiutangGrup = {
  pelanggan: string;
  baris: PiutangBaris[];
  totalJumlah: number;
  totalSisa: number;
};

export type PiutangPelangganSnapshot = {
  /** Label posisi, ex: "Per 30 September 2026". */
  label: string;
  tanggal: string;
  grup: PiutangGrup[];
  grandJumlah: number;
  grandSisa: number;
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

/** Akhir periode untuk preset (dipakai mengisi date picker "per tanggal"). */
export function akhirUntuk(periode: PiutangPelangganPeriode, now = new Date()): Date {
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
    case "tahun-ini":
      return new Date(now.getFullYear(), 11, 31);
    case "tahun-lalu":
      return new Date(now.getFullYear() - 1, 11, 31);
    case "custom":
      return today;
  }
}
