// Helper server-side modul Pembelian (JANGAN diimpor dari Client Component).
import { prisma } from "@/lib/prisma";
import type { TipeDokumenBeli } from "@/lib/validations/pembelianValidation";

const PREFIX_BY_TIPE: Record<TipeDokumenBeli, string> = {
  PERMINTAAN: "PR",
  PENAWARAN: "QTN-B",
  PESANAN: "PO",
};

function randomSuffix(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// Nomor dokumen pembelian unik per tipe, ex: PO-20260922-AB12.
export async function generateNoDokumenBeli(tipe: TipeDokumenBeli, tanggal: Date = new Date()): Promise<string> {
  const prefix = PREFIX_BY_TIPE[tipe] ?? "DOC";
  const ymd = `${tanggal.getFullYear()}${String(tanggal.getMonth() + 1).padStart(2, "0")}${String(
    tanggal.getDate()
  ).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}-${ymd}-${randomSuffix()}`;
    const exists = await prisma.dokumenPembelian.findUnique({
      where: { noDokumen: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${prefix}-${ymd}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// Jumlah baris = qty * harga * (1 - diskon%/100), dibulatkan 2 desimal.
export function hitungJumlahBarisBeli(kuantitas: number, harga: number, diskonPersen: number): number {
  return Math.round(kuantitas * harga * (1 - diskonPersen / 100) * 100) / 100;
}
