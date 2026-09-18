// Helper server-side modul Penjualan (JANGAN diimpor dari Client Component).
import { prisma } from "@/lib/prisma";
import type { JenisPenjualan, TipeDokumen } from "@/lib/validations/penjualanValidation";

// Jenis penjualan → akun pendapatan otomatis (COA PT BST, dari database saat dipakai).
export const AKUN_PENDAPATAN_BY_JENIS: Record<JenisPenjualan, string> = {
  HASIL_KEBUN: "4101",
  TERNAK: "4102",
  IKAN: "4103",
  LAINNYA: "4104",
};

const PREFIX_BY_TIPE: Record<TipeDokumen, string> = {
  PENAWARAN: "QTN",
  PESANAN: "SO",
  PROFORMA: "PRO",
  TUKAR_FAKTUR: "TF",
  PENAGIHAN: "INV",
};

function randomSuffix(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// Nomor dokumen unik per tipe, ex: INV-20260917-AB12.
export async function generateNoDokumen(tipe: TipeDokumen, tanggal: Date = new Date()): Promise<string> {
  const prefix = PREFIX_BY_TIPE[tipe] ?? "DOC";
  const ymd = `${tanggal.getFullYear()}${String(tanggal.getMonth() + 1).padStart(2, "0")}${String(
    tanggal.getDate()
  ).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}-${ymd}-${randomSuffix()}`;
    const exists = await prisma.dokumenPenjualan.findUnique({
      where: { noDokumen: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${prefix}-${ymd}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// Jumlah baris = qty * harga * (1 - diskon%/100), dibulatkan 2 desimal.
export function hitungJumlahBaris(kuantitas: number, harga: number, diskonPersen: number): number {
  return Math.round(kuantitas * harga * (1 - diskonPersen / 100) * 100) / 100;
}
