// Chart of Accounts (COA) PT Bumi Surya Farm - sumber tunggal kategori transaksi.
import type { TipeTransaksi } from "@/lib/validations/keuanganValidation";

export type AkunCOA = { kode: string; nama: string };

// Pemasukan
export const COA_PEMASUKAN: AkunCOA[] = [
  { kode: "4101", nama: "Pendapatan Penjualan Hasil Kebun" },
  { kode: "4102", nama: "Pendapatan Penjualan Ternak (Ayam)" },
  { kode: "4103", nama: "Pendapatan Penjualan Ikan" },
  { kode: "4104", nama: "Pendapatan Lain-lain" },
];

// Pengeluaran
export const COA_PENGELUARAN: AkunCOA[] = [
  { kode: "5101", nama: "Beban Upah dan Gaji Pekerja" },
  { kode: "5201", nama: "Beban Pupuk dan Obat-obatan" },
  { kode: "5202", nama: "Beban Pakan dan Obat Ternak" },
  { kode: "5203", nama: "Beban Pembelian Bibit/Benih Tanaman Semusim" },
  { kode: "5204", nama: "Beban Pembelian Bibit/DOC/Ternak" },
  { kode: "5205", nama: "Beban Panen dan Pengolahan Hasil Ternak" },
  { kode: "5301", nama: "Beban Perlengkapan Kebun" },
  { kode: "5302", nama: "Beban Peralatan Kecil" },
  { kode: "5401", nama: "Beban Transportasi dan BBM" },
  { kode: "5402", nama: "Beban Lain-lain/Belum Teridentifikasi" },
  { kode: "5403", nama: "Beban Sewa Tanah/Garapan" },
  { kode: "5404", nama: "Beban Listrik" },
  { kode: "5405", nama: "Beban Air/PDAM" },
  { kode: "5406", nama: "Beban Internet/Telepon/WIFI" },
];

// Sumber Dana
export const SUMBER_DANA = {
  KAS: { kode: "1101", label: "Kas" },
  BANK: { kode: "1103", label: "Bank" },
  TABUNGAN: { kode: "1104", label: "Tabungan" },
} as const;

export type SumberDanaKey = keyof typeof SUMBER_DANA;

export const SUMBER_DANA_KEYS = Object.keys(SUMBER_DANA) as SumberDanaKey[];

// Daftar kategori per tipe untuk dropdown / validasi.
export function kategoriByTipe(tipe: TipeTransaksi): AkunCOA[] {
  return tipe === "PEMASUKAN" ? COA_PEMASUKAN : COA_PENGELUARAN;
}

// Cari kode akun berdasarkan tipe + nama kategori. null jika tidak dikenal (data lama).
export function kodeAkunByNama(tipe: TipeTransaksi, nama: string): string | null {
  const akun = kategoriByTipe(tipe).find((a) => a.nama === nama);
  return akun ? akun.kode : null;
}

// Label sumber dana, ex: "Kas". Kode akun tetap tersimpan di SUMBER_DANA (internal).
export function labelSumberDana(key: string | null | undefined): string {
  const map = SUMBER_DANA[(key || "") as SumberDanaKey];
  return map ? map.label : "—";
}