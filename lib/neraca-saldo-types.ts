// Tipe & konstanta Laporan Neraca Saldo (Trial Balance) yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/neraca-types.ts.)

export const NERACA_SALDO_PERIODE = [
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

export type NeracaSaldoPeriode = (typeof NERACA_SALDO_PERIODE)[number];

export const NERACA_SALDO_PERIODE_LABEL: Record<NeracaSaldoPeriode, string> = {
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

export type NeracaSaldoBaris = {
  kode: string;
  nama: string;
  kelompok: string;
  /** Saldo awal (neto sebelum periode) di sisi debit. */
  saldoAwalDebit: number;
  /** Saldo awal (neto sebelum periode) di sisi kredit. */
  saldoAwalKredit: number;
  /** Total sisi debit pada periode (pergerakan). */
  debit: number;
  /** Total sisi kredit pada periode (pergerakan). */
  kredit: number;
  /** Saldo akhir (neto s/d akhir periode) di sisi debit. */
  akhirDebit: number;
  /** Saldo akhir (neto s/d akhir periode) di sisi kredit. */
  akhirKredit: number;
};

/** Satu kelompok akun (Aset/Kewajiban/Ekuitas/Pendapatan/Beban) + subtotalnya. */
export type NeracaSaldoGrup = {
  /** Nama tampil: Aset | Kewajiban | Ekuitas | Pendapatan | Beban. */
  nama: string;
  baris: NeracaSaldoBaris[];
  totalAwalDebit: number;
  totalAwalKredit: number;
  totalDebit: number;
  totalKredit: number;
  totalAkhirDebit: number;
  totalAkhirKredit: number;
};

export type NeracaSaldoSnapshot = {
  periode: NeracaSaldoPeriode;
  start: string;
  end: string;
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  /** Seluruh baris akun (urut kelompok lalu kode). */
  baris: NeracaSaldoBaris[];
  /** Baris dikelompokkan Aset → Kewajiban → Ekuitas → Pendapatan → Beban. */
  grup: NeracaSaldoGrup[];
  totalAwalDebit: number;
  totalAwalKredit: number;
  totalDebit: number;
  totalKredit: number;
  totalAkhirDebit: number;
  totalAkhirKredit: number;
  /** Seimbang bila tiap pasang debit = kredit (awal, gerak, akhir). */
  seimbang: boolean;
  /** Penjelasan sumber data & cakupan. */
  catatan: string[];
};
