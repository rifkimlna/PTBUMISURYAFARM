// Tipe & konstanta Laporan Neraca yang aman untuk Client Component.
// (Tanpa impor server/prisma — pola yang sama dengan lib/coa-types.ts.)

export const NERACA_PERIODE = [
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
  "per-bulan-tahun-ini",
  "custom",
] as const;

export type NeracaPeriode = (typeof NERACA_PERIODE)[number];

export const NERACA_PERIODE_LABEL: Record<NeracaPeriode, string> = {
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
  "per-bulan-tahun-ini": "Per bulan tahun ini",
  custom: "Custom",
};

export type NeracaBaris = { kode: string; nama: string; nilai: number };
export type NeracaKelompok = { judul: string; baris: NeracaBaris[]; total: number };

export type NeracaSnapshot = {
  periode: NeracaPeriode;
  /** Batas awal periode (waktu setempat). */
  start: string;
  /** Titik waktu laporan (akhir periode, dibatasi maksimal saat ini). */
  end: string;
  /** Label rentang untuk kop laporan, ex: "1 – 30 September 2026". */
  label: string;
  aktivaLancar: NeracaKelompok;
  aktivaTetap: NeracaKelompok;
  penyusutan: NeracaKelompok;
  totalAktiva: number;
  kewajibanLancar: NeracaKelompok;
  totalKewajiban: number;
  modal: NeracaKelompok;
  totalModal: number;
  totalKewajibanModal: number;
  /** Rincian pendukung untuk transparansi angka. */
  labaBasisKas: number;
  modalImplisit: number;
  /** Penjelasan bagian yang belum didukung data. */
  catatan: string[];
};
