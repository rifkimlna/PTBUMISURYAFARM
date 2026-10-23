// Tipe & konstanta Laporan Hutang Supplier yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/piutang-pelanggan-types.ts.)
// Laporan POSISI per tanggal: semua tagihan HUTANG bertanggal <= tanggal
// laporan yang masih bersaldo (jumlah − pembayaran s/d tanggal itu).

export const HUTANG_SUPPLIER_PERIODE = [
  "hari-ini",
  "pekan-ini",
  "bulan-ini",
  "kuartal-ini",
  "tahun-ini",
  "kemarin",
  "pekan-lalu",
  "bulan-lalu",
  "kuartal-lalu",
  "tahun-lalu",
  "custom",
] as const;

export type HutangSupplierPeriode = (typeof HUTANG_SUPPLIER_PERIODE)[number];

export const HUTANG_SUPPLIER_PERIODE_LABEL: Record<HutangSupplierPeriode, string> = {
  "hari-ini": "Hari ini",
  "pekan-ini": "Pekan ini",
  "bulan-ini": "Bulan ini",
  "kuartal-ini": "Kuartal ini",
  "tahun-ini": "Tahun ini",
  kemarin: "Kemarin",
  "pekan-lalu": "Pekan lalu",
  "bulan-lalu": "Bulan lalu",
  "kuartal-lalu": "Kuartal lalu",
  "tahun-lalu": "Tahun lalu",
  custom: "Custom",
};

export type HutangBaris = {
  id: string;
  tanggal: string;
  /** Jenis baris mutasi: saldo awal periode, faktur (+), atau pembayaran (−). */
  jenis: "saldo-awal" | "faktur" | "pembayaran";
  transaksi: string;
  no: string;
  /** ISO tanggal jatuh tempo tagihan; null bila tidak diisi / bukan faktur. */
  jatuhTempo: string | null;
  keterangan: string;
  /** Bertanda: +jumlah faktur, −pembayaran, 0 untuk saldo awal. */
  jumlah: number;
  /** Saldo berjalan per supplier setelah baris ini. */
  saldo: number;
};

export type HutangGrup = {
  supplier: string;
  baris: HutangBaris[];
  /** Saldo awal supplier per tanggal awal periode (dari data aktual). */
  saldoAwal: number;
  /** Total faktur dalam periode (komponen + mutasi). */
  totalFaktur: number;
  /** Total pembayaran dalam periode (komponen − mutasi). */
  totalBayar: number;
  /** Total kolom Jumlah (sama dengan totalFaktur). */
  totalJumlah: number;
  /** Saldo akhir supplier (= saldoAwal + totalFaktur − totalBayar). */
  totalSaldo: number;
};

export type HutangSupplierSnapshot = {
  /** Label posisi untuk kop laporan, ex: "Per 14 Oktober 2026". */
  label: string;
  /** ISO tanggal posisi (akhir periode). */
  tanggal: string;
  /** Grup supplier pada halaman aktif (bila paginasi dipakai). */
  grup: HutangGrup[];
  /** Jumlah SELURUH grup supplier terfilter (bukan hanya halaman aktif). */
  totalGrup: number;
  /** Grand total dari SELURUH grup terfilter (bukan hanya halaman aktif). */
  grandJumlah: number;
  grandSaldo: number;
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
export function akhirUntukHutang(periode: HutangSupplierPeriode, now = new Date()): Date {
  const today = startOfDayLokal(now);
  switch (periode) {
    case "hari-ini":
      return today;
    case "kemarin":
      return addDaysLokal(today, -1);
    case "pekan-ini": {
      const dow = (today.getDay() + 6) % 7;
      return addDaysLokal(today, -dow + 6);
    }
    case "pekan-lalu": {
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
