import { prisma } from "@/lib/prisma";

// Saldo kontak dari data Tagihan nyata (bukan dummy):
// - Pelanggan -> sisa piutang terbuka (Tagihan PIUTANG, status belum lunas)
// - Supplier -> sisa utang terbuka (Tagihan HUTANG, status belum lunas)
// - Karyawan / Lainnya -> null (tidak berlaku)
// Kunci dinormalisasi (trim + lowercase) karena Tagihan.pihak adalah snapshot
// nama saat dokumen dibuat, sedangkan Kontak.nama bisa disunting kemudian.
export async function saldoKontakMap(): Promise<Map<string, number>> {
  const terbuka = await prisma.tagihan.groupBy({
    by: ["tipe", "pihak"],
    where: { status: { not: "LUNAS" } },
    _sum: { sisa: true },
  });
  const map = new Map<string, number>();
  for (const t of terbuka) {
    const key = `${t.tipe}::${t.pihak.trim().toLowerCase()}`;
    map.set(key, (map.get(key) ?? 0) + Number(t._sum.sisa ?? 0));
  }
  return map;
}

export function saldoForKontak(
  saldoMap: Map<string, number>,
  tipe: string,
  nama: string
): number | null {
  const key = nama.trim().toLowerCase();
  if (tipe === "PELANGGAN") return saldoMap.get(`PIUTANG::${key}`) ?? 0;
  if (tipe === "SUPPLIER") return saldoMap.get(`HUTANG::${key}`) ?? 0;
  return null;
}
