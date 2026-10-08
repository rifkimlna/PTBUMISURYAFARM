// Tipe & konstanta Monitor Anggaran Laba Rugi (anggaran vs aktual per periode).
// Aman untuk Client Component (tanpa impor server/prisma).

/** Pilihan "Anggaran dari" — jumlah bulan ke belakang (inklusif bulan berakhir). */
export const MONITOR_LIHAT_BALIK = [1, 2, 3, 4, 6, 8, 12, 24] as const;
export type MonitorLihatBalik = (typeof MONITOR_LIHAT_BALIK)[number];

/** Pilihan "Tampilkan setiap" — ukuran bucket agregasi dalam bulan. */
export const MONITOR_TAMPIL_SETIAP = [1, 3, 4, 6, 12] as const;
export type MonitorTampilSetiap = (typeof MONITOR_TAMPIL_SETIAP)[number];

/** Template laporan yang tersedia (saat ini satu template standar). */
export const MONITOR_TEMPLATE = ["standar"] as const;
export type MonitorTemplate = (typeof MONITOR_TEMPLATE)[number];

export const MONITOR_TEMPLATE_LABEL: Record<MonitorTemplate, string> = {
  standar: "Laba Rugi Standar",
};

/** Satu bulan kalender dalam window monitor. */
export type MonitorBulan = { tahun: number; bulan: number; label: string };

/** Satu kolom tampilan = agregasi N bulan, masing-masing bernilai Anggaran + Aktual. */
export type MonitorKolom = {
  label: string;
  bulan: MonitorBulan[];
};

/** Satu akun dalam section: nilai per kolom (sejajar dengan MonitorSnapshot.kolom). */
export type MonitorAkunNilai = {
  kode: string;
  nama: string;
  anggaran: number[];
  aktual: number[];
};

/** Satu section laporan (Revenue / Cost of Sales / Operational Expense / Other). */
export type MonitorSection = {
  key: "revenue" | "cos" | "opex" | "otherIncome" | "otherExpense";
  judul: string;
  akun: MonitorAkunNilai[];
  totalAnggaran: number[];
  totalAktual: number[];
};

/** Baris laba turunan (Gross Profit / Operating Profit / Profit Loss). */
export type MonitorProfitRow = {
  key: string;
  judul: string;
  anggaran: number[];
  aktual: number[];
};

export type MonitorSnapshot = {
  anggaranId: string;
  anggaranNama: string;
  /** Label rentang window, ex: "Januari 2026 – Desember 2026". */
  label: string;
  berakhirPada: string;
  lihatBalik: number;
  tampilSetiap: number;
  kolom: MonitorKolom[];
  revenue: MonitorSection;
  cos: MonitorSection;
  grossProfit: MonitorProfitRow;
  opex: MonitorSection;
  operatingProfit: MonitorProfitRow;
  otherIncome: MonitorSection;
  otherExpense: MonitorSection;
  otherTotal: MonitorProfitRow;
  profit: MonitorProfitRow;
  /** Kolom total lintas periode (jumlah seluruh kolom). */
  totalAkhir: {
    revenueAnggaran: number;
    revenueAktual: number;
    cosAnggaran: number;
    cosAktual: number;
    grossAnggaran: number;
    grossAktual: number;
    opexAnggaran: number;
    opexAktual: number;
    operatingAnggaran: number;
    operatingAktual: number;
    otherAnggaran: number;
    otherAktual: number;
    profitAnggaran: number;
    profitAktual: number;
  };
  catatan: string[];
};

export type MonitorAnggaranOption = {
  id: string;
  nama: string;
  tahunMulai: number;
  bulanMulai: number;
  durasi: number;
  updatedAt: string;
};
