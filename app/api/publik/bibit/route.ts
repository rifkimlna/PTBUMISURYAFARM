import { prisma, isDbConnectionError } from "@/lib/prisma";
import { hitungStokSaatIni, tentukanStatusStok } from "@/lib/persediaan";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/publik/bibit - katalog bibit untuk home page (TANPA login)
// Hanya field aman: tanpa HPP/harga beli. Gagal DB -> list kosong, bukan 500.
export async function GET() {
  try {
    const [barang, agg] = await Promise.all([
      prisma.persediaanBarang.findMany({
        where: { kategori: "Bibit/Benih" },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.riwayatStok.groupBy({ by: ["barangId", "jenis"], _sum: { jumlah: true } }),
    ]);

    const map = new Map<string, { MASUK: number; KELUAR: number }>();
    for (const a of agg) {
      const entry = map.get(a.barangId) ?? { MASUK: 0, KELUAR: 0 };
      entry[a.jenis] += a._sum.jumlah ?? 0;
      map.set(a.barangId, entry);
    }

    const data = barang.map((b) => {
      const sums = map.get(b.id) ?? { MASUK: 0, KELUAR: 0 };
      const stok = hitungStokSaatIni(b.stokAwal, [
        { jenis: "MASUK", jumlah: sums.MASUK },
        { jenis: "KELUAR", jumlah: sums.KELUAR },
      ]);
      return {
        id: b.id,
        nama: b.namaBarang,
        harga: b.hargaJual == null ? Number(b.hargaSatuan) : Number(b.hargaJual),
        satuan: b.satuan,
        stok,
        fotoUrl: b.fotoUrl,
        keterangan: b.keterangan,
        status: tentukanStatusStok(stok),
      };
    });

    return successResponse({ data, total: data.length });
  } catch (e) {
    if (isDbConnectionError(e)) return successResponse({ data: [], total: 0 }, "Katalog menyusul");
    return errorResponse(e instanceof Error ? e.message : "Gagal muat katalog", 500);
  }
}
