// Helper server-side untuk modul Kas & Bank (JANGAN diimpor dari Client Component).
import { prisma } from "@/lib/prisma";

export type SaldoPerSumber = {
  KAS: number;
  BANK: number;
  TABUNGAN: number;
};

const SUMBER_LIST = ["KAS", "BANK", "TABUNGAN"] as const;

type DateRange = { gte?: Date; lte?: Date };

// Saldo per sumber dana dari database.
// Rumus: PEMASUKAN - PENGELUARAN - TRANSFER keluar + TRANSFER masuk (via sumberDanaTujuan).
// TRANSFER dicatat sebagai SATU baris, bukan pemasukan/pengeluaran.
export async function getSaldoPerSumber(range?: DateRange): Promise<SaldoPerSumber> {
  const tanggalFilter = range && (range.gte || range.lte) ? { tanggal: { ...range } } : {};
  const [perSumber, perTujuan] = await Promise.all([
    prisma.transaksiKas.groupBy({
      by: ["sumberDana", "tipe"],
      where: tanggalFilter,
      _sum: { jumlah: true },
    }),
    prisma.transaksiKas.groupBy({
      by: ["sumberDanaTujuan", "tipe"],
      where: tanggalFilter,
      _sum: { jumlah: true },
    }),
  ]);

  const saldo = (sumber: string) => {
    const masuk = Number(
      perSumber.find((s) => s.sumberDana === sumber && s.tipe === "PEMASUKAN")?._sum.jumlah ?? 0
    );
    const keluar = Number(
      perSumber.find((s) => s.sumberDana === sumber && s.tipe === "PENGELUARAN")?._sum.jumlah ?? 0
    );
    const transferKeluar = Number(
      perSumber.find((s) => s.sumberDana === sumber && s.tipe === "TRANSFER")?._sum.jumlah ?? 0
    );
    const transferMasuk = Number(
      perTujuan.find((s) => s.sumberDanaTujuan === sumber && s.tipe === "TRANSFER")?._sum.jumlah ??
        0
    );
    return masuk - keluar - transferKeluar + transferMasuk;
  };

  return {
    KAS: saldo("KAS"),
    BANK: saldo("BANK"),
    TABUNGAN: saldo("TABUNGAN"),
  };
}

const PREFIX_BY_TIPE = {
  PEMASUKAN: "IN",
  PENGELUARAN: "OUT",
  TRANSFER: "TRF",
} as const;

function randomSuffix(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// Generate No transaksi unik, ex: TRF-20260917-AB12. Retry bila collision.
export async function generateNoTransaksi(
  tipe: keyof typeof PREFIX_BY_TIPE,
  tanggal: Date = new Date()
): Promise<string> {
  const prefix = PREFIX_BY_TIPE[tipe] ?? "TRX";
  const ymd = `${tanggal.getFullYear()}${String(tanggal.getMonth() + 1).padStart(2, "0")}${String(
    tanggal.getDate()
  ).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}-${ymd}-${randomSuffix()}`;
    const exists = await prisma.transaksiKas.findUnique({
      where: { noTransaksi: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  // Fallback terakhir: pakai timestamp agar praktis unik
  return `${prefix}-${ymd}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export { SUMBER_LIST };
