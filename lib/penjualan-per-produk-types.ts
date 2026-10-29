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

// ---------- Helper tanggal WIB (pure, aman untuk Client Component) ----------
//
// Batas tanggal laporan selalu memakai kalender WIB (UTC+7), bukan zona server
// browser/server. Awal hari = 00:00:00.000 WIB, akhir hari = 23:59:59.999 WIB,
// sehingga transaksi pada tanggal batas tidak hilang.

const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdDariUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Validasi & pecah "YYYY-MM-DD" (menolak tanggal yang tidak ada, ex: 2026-02-31). */
function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!cocok) throw new Error("Tanggal tidak valid");
  const y = Number(cocok[1]);
  const m = Number(cocok[2]);
  const d = Number(cocok[3]);
  const cek = new Date(Date.UTC(y, m - 1, d));
  if (cek.getUTCFullYear() !== y || cek.getUTCMonth() !== m - 1 || cek.getUTCDate() !== d)
    throw new Error("Tanggal tidak valid");
  return { y, m, d };
}

/** Tanggal kalender WIB (YYYY-MM-DD) dari sebuah instant. */
function tanggalWIB(d: Date = new Date()): string {
  return ymdDariUtc(new Date(d.getTime() + OFFSET_WIB_MS));
}

/** Instant awal hari (00:00:00.000 WIB) untuk tanggal YYYY-MM-DD. */
function awalHariWIB(ymd: string): Date {
  const { y, m, d } = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d) - OFFSET_WIB_MS);
}

/** Instant akhir hari (23:59:59.999 WIB) untuk tanggal YYYY-MM-DD. */
function akhirHariWIB(ymd: string): Date {
  const { y, m, d } = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - OFFSET_WIB_MS);
}

/** Geser tanggal YYYY-MM-DD sebanyak n hari (kalender murni). */
function tambahHariYmd(ymd: string, n: number): string {
  const { y, m, d } = parseYmd(ymd);
  return ymdDariUtc(new Date(Date.UTC(y, m - 1, d + n)));
}

function tglUtc(y: number, m: number, d: number): string {
  return ymdDariUtc(new Date(Date.UTC(y, m - 1, d)));
}

function hariTerakhirBulan(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Rentang tanggal (YYYY-MM-DD, kalender WIB) untuk preset; null untuk custom. */
function rentangPeriode(
  periode: PenjualanPerProdukPeriode,
  now = new Date()
): { dari: string; sampai: string } | null {
  if (periode === "custom") return null;
  const hariIni = tanggalWIB(now);
  const { y, m, d } = parseYmd(hariIni);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Senin = 0

  switch (periode) {
    case "hari-ini":
      return { dari: hariIni, sampai: hariIni };
    case "kemarin": {
      const x = tambahHariYmd(hariIni, -1);
      return { dari: x, sampai: x };
    }
    case "minggu-ini": {
      const awal = tambahHariYmd(hariIni, -dow);
      return { dari: awal, sampai: tambahHariYmd(awal, 6) };
    }
    case "minggu-lalu": {
      const awal = tambahHariYmd(hariIni, -dow - 7);
      return { dari: awal, sampai: tambahHariYmd(awal, 6) };
    }
    case "bulan-ini":
      return { dari: tglUtc(y, m, 1), sampai: tglUtc(y, m, hariTerakhirBulan(y, m)) };
    case "bulan-lalu": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { dari: tglUtc(py, pm, 1), sampai: tglUtc(py, pm, hariTerakhirBulan(py, pm)) };
    }
    case "kuartal-ini": {
      const q = Math.floor((m - 1) / 3);
      const bulanAwal = q * 3 + 1;
      return {
        dari: tglUtc(y, bulanAwal, 1),
        sampai: tglUtc(y, bulanAwal + 2, hariTerakhirBulan(y, bulanAwal + 2)),
      };
    }
    case "kuartal-lalu": {
      const q = Math.floor((m - 1) / 3) - 1;
      const qy = q < 0 ? y - 1 : y;
      const qq = q < 0 ? q + 4 : q;
      const bulanAwal = qq * 3 + 1;
      return {
        dari: tglUtc(qy, bulanAwal, 1),
        sampai: tglUtc(qy, bulanAwal + 2, hariTerakhirBulan(qy, bulanAwal + 2)),
      };
    }
    case "tahun-ini":
      return { dari: tglUtc(y, 1, 1), sampai: tglUtc(y, 12, 31) };
    case "tahun-lalu":
      return { dari: tglUtc(y - 1, 1, 1), sampai: tglUtc(y - 1, 12, 31) };
  }
}

/** Label tanggal panjang, ex: "1 Oktober 2026" (kalender WIB). */
function formatTglWIB(ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Sumber periode laporan: tanggal awal & akhir yang dipilih (custom) atau
 * rentang preset. Mengembalikan batas query (awal/akhir hari WIB), tanggal
 * YMD (untuk nama file), dan label yang dipakai tabel/PDF/XLSX.
 */
function resolvePeriodeTanggal(
  periode: PenjualanPerProdukPeriode,
  tanggalAwals?: string,
  tanggalAkhirs?: string,
  now = new Date()
): { dariYmd: string; sampaiYmd: string; dari: Date; sampai: Date; label: string } {
  let dariYmd: string;
  let sampaiYmd: string;

  if (periode === "custom") {
    if (!tanggalAwals || !tanggalAkhirs) throw new Error("Tanggal awal dan akhir wajib diisi");
    parseYmd(tanggalAwals);
    parseYmd(tanggalAkhirs);
    if (tanggalAwals > tanggalAkhirs)
      throw new Error("Tanggal awal tidak boleh lebih besar dari tanggal akhir");
    dariYmd = tanggalAwals;
    sampaiYmd = tanggalAkhirs;
  } else {
    const rentang = rentangPeriode(periode, now);
    if (!rentang) throw new Error("Periode tidak valid");
    dariYmd = rentang.dari;
    sampaiYmd = rentang.sampai;
  }

  return {
    dariYmd,
    sampaiYmd,
    dari: awalHariWIB(dariYmd),
    sampai: akhirHariWIB(sampaiYmd),
    label: `Periode ${formatTglWIB(dariYmd)} - ${formatTglWIB(sampaiYmd)}`,
  };
}

// Export the helper functions for use in server and client
export {
  PENJUALAN_PER_PRODUK_PERIODE,
  PENJUALAN_PER_PRODUK_PERIODE_LABEL,
  tanggalWIB,
  rentangPeriode,
  resolvePeriodeTanggal,
  formatTglWIB,
  awalHariWIB,
  akhirHariWIB,
};
export type {
  PenjualanPerProdukPeriode,
  PenjualanBaris,
  PenjualanPerProdukSnapshot,
};
