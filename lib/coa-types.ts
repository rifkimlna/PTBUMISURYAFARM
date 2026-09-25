// Chart of Accounts (COA) - Shared Type Definitions
// This file is safe for both Client and Server Components

import type { TipeTransaksi } from "@/lib/validations/keuanganValidation";

export type KelompokCOA = "Aset" | "Kewajiban" | "Modal" | "Pendapatan" | "Beban";
export type TipeAkunCOA = "PEMASUKAN" | "PENGELUARAN" | "NETRAL";

export type AkunCOA = {
  kode: string;
  nama: string;
  kelompok: KelompokCOA;
  golongan: string;
  tipe: TipeAkunCOA;
  deskripsi?: string | null;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: { id: string; nama: string } | null;
};

export const KELOMPOK_URUTAN: KelompokCOA[] = ["Aset", "Kewajiban", "Modal", "Pendapatan", "Beban"];

// Tipe mapping from kelompok
export const TIPE_BY_KELOMPOK: Record<KelompokCOA, TipeAkunCOA> = {
  Aset: "NETRAL",
  Kewajiban: "NETRAL",
  Modal: "NETRAL",
  Pendapatan: "PEMASUKAN",
  Beban: "PENGELUARAN",
};

// Golongan per kelompok (for dropdown in form)
export const GOLOGAN_BY_KELOMPOK: Record<KelompokCOA, string[]> = {
  Aset: ["Kas & Setara", "Piutang Usaha", "Persediaan", "Aset Tetap"],
  Kewajiban: ["Utang"],
  Modal: ["Modal", "Laba Ditahan"],
  Pendapatan: ["Pendapatan Usaha", "Pendapatan Lainnya"],
  Beban: [
    "Beban Tenaga Kerja",
    "Beban Produksi",
    "Beban Perlengkapan & Peralatan",
    "Beban Operasional",
    "Pelunasan Hutang",
  ],
};

// Sumber Dana
export const SUMBER_DANA = {
  KAS: { kode: "1101", label: "Kas" },
  BANK: { kode: "1103", label: "Bank" },
  TABUNGAN: { kode: "1104", label: "Tabungan" },
} as const;

export type SumberDanaKey = keyof typeof SUMBER_DANA;
export const SUMBER_DANA_KEYS = Object.keys(SUMBER_DANA) as SumberDanaKey[];

// Mapping kode akun sumber dana -> enum sumberDana
export const SUMBER_DANA_KODE_MAP: Record<string, "KAS" | "BANK" | "TABUNGAN"> = {
  "1101": "KAS",
  "1103": "BANK",
  "1104": "TABUNGAN",
};

// Mapping enum sumberDana -> kode akun (reverse of SUMBER_DANA_KODE_MAP)
export const SUMBER_DANA_KODE_ENUM_MAP: Record<SumberDanaKey, string> = {
  KAS: "1101",
  BANK: "1103",
  TABUNGAN: "1104",
} as const;