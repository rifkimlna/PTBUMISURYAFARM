// Tipe & konstanta Laporan Daftar Pengeluaran yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/detail-pengeluaran-types.ts.)
//
// Laporan "Daftar Pengeluaran" = daftar setiap transaksi biaya/pengeluaran
// (satu baris per pengeluaran, urut tanggal) dengan kolom Tanggal, Nomor,
// Kategori, Deskripsi, Supplier, dan Jumlah. Satu pengeluaran dihitung tepat
// satu kali (tanpa transaksi ganda).

export const DAFTAR_PENGELUARAN_PERIODE = [
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

export type DaftarPengeluaranPeriode = (typeof DAFTAR_PENGELUARAN_PERIODE)[number];

export const DAFTAR_PENGELUARAN_PERIODE_LABEL: Record<DaftarPengeluaranPeriode, string> = {
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

/** Satu baris pengeluaran (transaksi biaya) dalam laporan. */
export type DaftarPengeluaranBaris = {
  id: string;
  /** ISO tanggal transaksi. */
  tanggal: string;
  /** Nomor dokumen biaya / transaksi kas. */
  nomor: string | null;
  /** Nama akun biaya / kategori biaya. */
  kategori: string;
  /** Memo / keterangan / deskripsi. */
  deskripsi: string | null;
  /** Supplier / penerima / pihak. */
  supplier: string | null;
  jumlah: number;
  /** Sumber baris: "Biaya" (model Biaya) atau "Kas" (TransaksiKas PENGELUARAN). */
  sumber: "Biaya" | "Kas";
};

export type DaftarPengeluaranSnapshot = {
  periode: DaftarPengeluaranPeriode;
  start: string;
  end: string;
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  baris: DaftarPengeluaranBaris[];
  grandTotal: number;
  jumlahTransaksi: number;
  /** Penjelasan sumber data & cakupan. */
  catatan: string[];
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

/** Cerminan resolveDaftarPengeluaranRange (server) — mengisi otomatis tanggal awal/akhir. */
export function rentangUntukDaftarPengeluaran(
  periode: DaftarPengeluaranPeriode,
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
