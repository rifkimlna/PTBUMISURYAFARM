import { NextRequest } from "next/server";
import { prisma, isDbConnectionError } from "@/lib/prisma";
import { hitungStokSaatIni, tentukanStatusStok } from "@/lib/persediaan";
import { successResponse, errorResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// GET /api/publik/bibit/[id] - detail 1 bibit (TANPA login)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const b = await prisma.persediaanBarang.findUnique({ where: { id: id.toUpperCase() } });
    if (!b || b.kategori !== "Bibit/Benih") return errorResponse("Bibit tidak ditemukan", 404);

    const agg = await prisma.riwayatStok.groupBy({
      by: ["jenis"],
      where: { barangId: b.id },
      _sum: { jumlah: true },
    });
    const masuk = agg.find((a) => a.jenis === "MASUK")?._sum.jumlah ?? 0;
    const keluar = agg.find((a) => a.jenis === "KELUAR")?._sum.jumlah ?? 0;
    const stok = hitungStokSaatIni(b.stokAwal, [
      { jenis: "MASUK", jumlah: masuk },
      { jenis: "KELUAR", jumlah: keluar },
    ]);

    return successResponse({
      id: b.id,
      nama: b.namaBarang,
      harga: b.hargaJual == null ? Number(b.hargaSatuan) : Number(b.hargaJual),
      satuan: b.satuan,
      stok,
      fotoUrl: b.fotoUrl,
      keterangan: b.keterangan,
      status: tentukanStatusStok(stok),
    });
  } catch (e) {
    if (isDbConnectionError(e)) return errorResponse("Katalog tidak terhubung, coba lagi nanti", 503);
    return errorResponse(e instanceof Error ? e.message : "Gagal muat bibit", 500);
  }
}
