// Mapping antara kategori Persediaan Barang dan Kode Akun COA
// File ini digunakan untuk integrasi otomatis Persediaan → Kas & Bank → COA

import type { KategoriPersediaan } from "./validations/persediaanValidation";

export type { KategoriPersediaan } from "./validations/persediaanValidation";

export interface PersediaanCOAMapping {
  kategori: KategoriPersediaan;
  kodeAkunPersediaan: string; // COA kode untuk persediaan (Aset)
  namaAkunPersediaan: string;
  kodeAkunSumberDana: Record<"KAS" | "BANK" | "TABUNGAN", string>; // COA kode untuk sumber dana
}

// Mapping standar berdasarkan COA PT Bumi Surya Farm
export const PERSEDIAAN_COA_MAPPING: PersediaanCOAMapping[] = [
  {
    kategori: "Pupuk & Obat-obatan",
    kodeAkunPersediaan: "1105",
    namaAkunPersediaan: "Persediaan Pupuk & Obat-obatan",
    kodeAkunSumberDana: {
      KAS: "1101",
      BANK: "1103",
      TABUNGAN: "1104",
    },
  },
  {
    kategori: "Pakan Ternak/Ikan",
    kodeAkunPersediaan: "1106",
    namaAkunPersediaan: "Persediaan Pakan Ternak/Ikan",
    kodeAkunSumberDana: {
      KAS: "1101",
      BANK: "1103",
      TABUNGAN: "1104",
    },
  },
  {
    kategori: "Bibit/Benih",
    kodeAkunPersediaan: "1107",
    namaAkunPersediaan: "Persediaan Bibit/Benih",
    kodeAkunSumberDana: {
      KAS: "1101",
      BANK: "1103",
      TABUNGAN: "1104",
    },
  },
];

export function getCOAMappingByKategori(kategori: KategoriPersediaan): PersediaanCOAMapping | undefined {
  return PERSEDIAAN_COA_MAPPING.find((m) => m.kategori === kategori);
}

export function getKodeAkunPersediaan(kategori: KategoriPersediaan): string | null {
  const mapping = getCOAMappingByKategori(kategori);
  return mapping?.kodeAkunPersediaan ?? null;
}

export function getKodeAkunSumberDana(kategori: KategoriPersediaan, sumberDana: "KAS" | "BANK" | "TABUNGAN"): string | null {
  const mapping = getCOAMappingByKategori(kategori);
  return mapping?.kodeAkunSumberDana[sumberDana] ?? null;
}

export function validateKategoriHasCOAMapping(kategori: string): { valid: boolean; error?: string } {
  const validKategori: KategoriPersediaan[] = ["Bibit/Benih", "Pupuk & Obat-obatan", "Pakan Ternak/Ikan"];
  if (!validKategori.includes(kategori as KategoriPersediaan)) {
    return { valid: false, error: `Kategori "${kategori}" tidak memiliki mapping COA. Kategori valid: ${validKategori.join(", ")}` };
  }
  const mapping = getCOAMappingByKategori(kategori as KategoriPersediaan);
  if (!mapping) {
    return { valid: false, error: `Mapping COA untuk kategori "${kategori}" tidak ditemukan` };
  }
  return { valid: true };
}

export function getAllKategoriWithCOA(): KategoriPersediaan[] {
  return PERSEDIAAN_COA_MAPPING.map((m) => m.kategori);
}