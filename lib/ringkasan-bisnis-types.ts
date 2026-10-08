// Tipe & konstanta Laporan Ringkasan Bisnis yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/arus-kas-types.ts.)
// Opsi periode identik dengan Laporan Arus Kas (template utama).

export const RINGKASAN_BISNIS_PERIODE = [
  "hari-ini",
  "minggu-ini",
  "bulan-ini",
  "tahun-ini",
  "bulan-lalu",
  "tahun-lalu",
  "per-bulan-tahun-ini",
  "custom",
] as const;

export type RingkasanBisnisPeriode = (typeof RINGKASAN_BISNIS_PERIODE)[number];

export const RINGKASAN_BISNIS_PERIODE_LABEL: Record<RingkasanBisnisPeriode, string> = {
  "hari-ini": "Hari Ini",
  "minggu-ini": "Mingguan",
  "bulan-ini": "Bulanan",
  "tahun-ini": "Tahunan",
  "bulan-lalu": "Bulan Lalu",
  "tahun-lalu": "Tahun Lalu",
  "per-bulan-tahun-ini": "Per bulan tahun ini",
  custom: "Custom",
};

export type RingkasanBaris = { label: string; nilai: number };

/** Indikator wawasan bisnis. `nilai` = desimal (0,25 = 25%) kecuali currentRatio
 *  & debtToEquity yang dalam satuan kali (x). null = tidak dapat dihitung. */
export type RasioBaris = { nama: string; nilai: number | null; satuan: "%" | "x" };

export type RingkasanBisnisSnapshot = {
  periode: RingkasanBisnisPeriode;
  start: string;
  end: string;
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  labaRugi: {
    pendapatan: number;
    hpp: number;
    labaKotor: number;
    biayaOperasional: number;
    labaOperasional: number;
    pendapatanLainnya: number;
    biayaLainnya: number;
    labaBersih: number;
  };
  neraca: {
    asetLancar: number;
    asetTetap: number;
    penyusutan: number;
    totalAset: number;
    liabilitasPendek: number;
    liabilitasPanjang: number;
    modal: number;
    totalLiabilitasModal: number;
  };
  arusKas: {
    operasional: number;
    investasi: number;
    pendanaan: number;
    kenaikan: number;
    saldoAwal: number;
    saldoAkhir: number;
  };
  wawasan: RasioBaris[];
  /** False bila tidak ada transaksi/angka pada periode (struktur tetap tampil, nilai Rp 0). */
  adaTransaksi: boolean;
  /** Penjelasan bagian yang belum didukung data. */
  catatan: string[];
};
