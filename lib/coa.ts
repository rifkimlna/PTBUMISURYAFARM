// Chart of Accounts (COA) PT Bumi Surya Farm - Client-side static data & shared utilities
// This file is safe for Client Components

import type { TipeTransaksi } from "@/lib/validations/keuanganValidation";

// Import types and values from shared types file
import type { AkunCOA, KelompokCOA, TipeAkunCOA, SumberDanaKey } from "./coa-types";
import { SUMBER_DANA, SUMBER_DANA_KEYS, SUMBER_DANA_KODE_MAP } from "./coa-types";
export type { AkunCOA, KelompokCOA, TipeAkunCOA, SumberDanaKey } from "./coa-types";
export { KELOMPOK_URUTAN, TIPE_BY_KELOMPOK, GOLOGAN_BY_KELOMPOK, SUMBER_DANA, SUMBER_DANA_KEYS, SUMBER_DANA_KODE_MAP } from "./coa-types";

// ============================================
// STATIC FALLBACK DATA (used when DB unavailable or client-side)
// ============================================

// Aset
const STATIC_COA_ASET: AkunCOA[] = [
  { kode: "1101", nama: "Kas", kelompok: "Aset", golongan: "Kas & Setara", tipe: "NETRAL" },
  { kode: "1102", nama: "Piutang", kelompok: "Aset", golongan: "Piutang Usaha", tipe: "NETRAL" },
  { kode: "1103", nama: "Bank", kelompok: "Aset", golongan: "Kas & Setara", tipe: "NETRAL" },
  { kode: "1104", nama: "Tabungan", kelompok: "Aset", golongan: "Kas & Setara", tipe: "NETRAL" },
  { kode: "1105", nama: "Persediaan Pupuk & Obat-obatan", kelompok: "Aset", golongan: "Persediaan", tipe: "NETRAL" },
  { kode: "1106", nama: "Persediaan Pakan Ternak/Ikan", kelompok: "Aset", golongan: "Persediaan", tipe: "NETRAL" },
  { kode: "1107", nama: "Persediaan Bibit/Benih", kelompok: "Aset", golongan: "Persediaan", tipe: "NETRAL" },
  { kode: "1201", nama: "Tanah", kelompok: "Aset", golongan: "Aset Tetap", tipe: "NETRAL" },
  { kode: "1202", nama: "Bangunan dan Instalasi", kelompok: "Aset", golongan: "Aset Tetap", tipe: "NETRAL" },
  { kode: "1203", nama: "Mesin dan Peralatan Pertanian/Peternakan", kelompok: "Aset", golongan: "Aset Tetap", tipe: "NETRAL" },
  { kode: "1204", nama: "Perabotan dan Peralatan Kantor/Villa", kelompok: "Aset", golongan: "Aset Tetap", tipe: "NETRAL" },
  { kode: "1205", nama: "Tanaman Produktif", kelompok: "Aset", golongan: "Aset Tetap", tipe: "NETRAL" },
  { kode: "1206", nama: "Ternak", kelompok: "Aset", golongan: "Aset Tetap", tipe: "NETRAL" },
  { kode: "1207", nama: "Ikan Budidaya", kelompok: "Aset", golongan: "Aset Tetap", tipe: "NETRAL" },
];

// Kewajiban
const STATIC_COA_KEWAJIBAN: AkunCOA[] = [
  { kode: "2101", nama: "Utang Usaha", kelompok: "Kewajiban", golongan: "Utang", tipe: "NETRAL" },
  { kode: "2102", nama: "Utang Gaji / Kasbon Karyawan", kelompok: "Kewajiban", golongan: "Utang", tipe: "NETRAL" },
  { kode: "2103", nama: "Utang Pajak", kelompok: "Kewajiban", golongan: "Utang", tipe: "NETRAL" },
  { kode: "2104", nama: "Utang Lain-lain", kelompok: "Kewajiban", golongan: "Utang", tipe: "NETRAL" },
];

// Modal
const STATIC_COA_MODAL: AkunCOA[] = [
  { kode: "3101", nama: "Modal Disetor / Setoran Pemilik (Bapak)", kelompok: "Modal", golongan: "Modal", tipe: "NETRAL" },
  { kode: "3102", nama: "Modal Disetor / Setoran Pemilik (Riki)", kelompok: "Modal", golongan: "Modal", tipe: "NETRAL" },
  { kode: "3103", nama: "Prive / Penarikan Modal", kelompok: "Modal", golongan: "Modal", tipe: "NETRAL" },
  { kode: "3104", nama: "Laba Ditahan (Akumulasi)", kelompok: "Modal", golongan: "Laba Ditahan", tipe: "NETRAL" },
];

// Pemasukan
export const STATIC_COA_PEMASUKAN: AkunCOA[] = [
  { kode: "4101", nama: "Pendapatan Penjualan Hasil Kebun", kelompok: "Pendapatan", golongan: "Pendapatan Usaha", tipe: "PEMASUKAN" },
  { kode: "4102", nama: "Pendapatan Penjualan Ternak (Ayam)", kelompok: "Pendapatan", golongan: "Pendapatan Usaha", tipe: "PEMASUKAN" },
  { kode: "4103", nama: "Pendapatan Penjualan Ikan", kelompok: "Pendapatan", golongan: "Pendapatan Usaha", tipe: "PEMASUKAN" },
  { kode: "4104", nama: "Pendapatan Lain-lain", kelompok: "Pendapatan", golongan: "Pendapatan Lainnya", tipe: "PEMASUKAN" },
  { kode: "4105", nama: "Penerimaan Piutang Usaha", kelompok: "Pendapatan", golongan: "Pendapatan Lainnya", tipe: "PEMASUKAN" },
];

// Pengeluaran
export const STATIC_COA_PENGELUARAN: AkunCOA[] = [
  { kode: "5101", nama: "Beban Upah dan Gaji Pekerja", kelompok: "Beban", golongan: "Beban Tenaga Kerja", tipe: "PENGELUARAN" },
  { kode: "5201", nama: "Beban Pupuk dan Obat-obatan", kelompok: "Beban", golongan: "Beban Produksi", tipe: "PENGELUARAN" },
  { kode: "5202", nama: "Beban Pakan dan Obat Ternak", kelompok: "Beban", golongan: "Beban Produksi", tipe: "PENGELUARAN" },
  { kode: "5203", nama: "Beban Pembelian Bibit/Benih Tanaman Semusim", kelompok: "Beban", golongan: "Beban Produksi", tipe: "PENGELUARAN" },
  { kode: "5204", nama: "Beban Pembelian Bibit/DOC/Ternak", kelompok: "Beban", golongan: "Beban Produksi", tipe: "PENGELUARAN" },
  { kode: "5205", nama: "Beban Panen dan Pengolahan Hasil Ternak", kelompok: "Beban", golongan: "Beban Produksi", tipe: "PENGELUARAN" },
  { kode: "5301", nama: "Beban Perlengkapan Kebun", kelompok: "Beban", golongan: "Beban Perlengkapan & Peralatan", tipe: "PENGELUARAN" },
  { kode: "5302", nama: "Beban Peralatan Kecil", kelompok: "Beban", golongan: "Beban Perlengkapan & Peralatan", tipe: "PENGELUARAN" },
  { kode: "5401", nama: "Beban Transportasi dan BBM", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5402", nama: "Beban Lain-lain/Belum Teridentifikasi", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5403", nama: "Beban Sewa Tanah/Garapan", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5404", nama: "Beban Listrik", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5405", nama: "Beban Air/PDAM", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5406", nama: "Beban Internet/Telepon/WIFI", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5407", nama: "Beban Pajak", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5408", nama: "Beban Penyusutan Aset Tetap", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5409", nama: "Beban Perawatan & Reparasi", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5410", nama: "Beban Administrasi & Umum", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5411", nama: "Beban Perlengkapan Kantor / ATK", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5412", nama: "Beban Konsumsi", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5413", nama: "Beban Mess", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5414", nama: "Beban Perlengkapan & Pemeliharaan Jaringan Air", kelompok: "Beban", golongan: "Beban Operasional", tipe: "PENGELUARAN" },
  { kode: "5501", nama: "Pelunasan Hutang Usaha", kelompok: "Beban", golongan: "Pelunasan Hutang", tipe: "PENGELUARAN" },
];

export const STATIC_ALL_COA: AkunCOA[] = [
  ...STATIC_COA_ASET,
  ...STATIC_COA_KEWAJIBAN,
  ...STATIC_COA_MODAL,
  ...STATIC_COA_PEMASUKAN,
  ...STATIC_COA_PENGELUARAN,
];

// ============================================
// CLIENT-SIDE / SHARED FUNCTIONS (use static data)
// ============================================

// Daftar kategori per tipe untuk dropdown / validasi (hanya Pemasukan & Pengeluaran)
export function kategoriByTipe(tipe: TipeTransaksi): AkunCOA[] {
  // TRANSFER tidak memiliki kategori COA karena ini perpindahan dana, bukan pemasukan/pengeluaran
  if (tipe === "TRANSFER") return [];
  return tipe === "PEMASUKAN" ? STATIC_COA_PEMASUKAN : STATIC_COA_PENGELUARAN;
}

// Cari kode akun berdasarkan tipe + nama kategori. null jika tidak dikenal (data lama).
export function kodeAkunByNama(tipe: TipeTransaksi, nama: string): string | null {
  // Untuk TRANSFER, tidak ada kode akun COA (hanya sumberDana + sumberDanaTujuan)
  if (tipe === "TRANSFER") return null;
  const akun = kategoriByTipe(tipe).find((a) => a.nama === nama);
  return akun ? akun.kode : null;
}

// Cari akun by kode (dari static data - client compatible)
export function getAkunByKode(kode: string): AkunCOA | undefined {
  return STATIC_ALL_COA.find((a) => a.kode === kode);
}

// Filter akun by kelompok (static)
export function getAkunByKelompok(kelompok: KelompokCOA): AkunCOA[] {
  return STATIC_ALL_COA.filter((a) => a.kelompok === kelompok);
}

// Group akun by kelompok then golongan (static)
export function getAkunGrouped(): Record<KelompokCOA, Record<string, AkunCOA[]>> {
  const result: Record<string, Record<string, AkunCOA[]>> = {};
  for (const kelompok of ["Aset", "Kewajiban", "Modal", "Pendapatan", "Beban"] as const) {
    result[kelompok] = {};
    for (const akun of getAkunByKelompok(kelompok)) {
      if (!result[kelompok][akun.golongan]) {
        result[kelompok][akun.golongan] = [];
      }
      result[kelompok][akun.golongan].push(akun);
    }
  }
  return result as Record<KelompokCOA, Record<string, AkunCOA[]>>;
}

// Label sumber dana, ex: "Kas". Kode akun tetap tersimpan di SUMBER_DANA (internal).
export function labelSumberDana(key: string | null | undefined): string {
  const map = SUMBER_DANA[(key || "") as SumberDanaKey];
  return map ? map.label : "—";
}