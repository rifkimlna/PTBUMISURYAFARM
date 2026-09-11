import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { createRiwayatStokSchema } from "@/lib/validations/persediaanValidation";
import { hitungStokSaatIni } from "@/lib/persediaan";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = createRiwayatStokSchema.parse(body);

    const barang = await prisma.persediaanBarang.findUnique({ where: { id } });
    if (!barang) return errorResponse("Barang tidak ditemukan", 404);

    // Hitung stok saat ini dari riwayat agar tidak bergantung stok manual
    const agg = await prisma.riwayatStok.groupBy({
      by: ["jenis"],
      where: { barangId: id },
      _sum: { jumlah: true },
    });
    const masuk = agg.find((a) => a.jenis === "MASUK")?._sum.jumlah ?? 0;
    const keluar = agg.find((a) => a.jenis === "KELUAR")?._sum.jumlah ?? 0;
    const stokSaatIni = hitungStokSaatIni(barang.stokAwal, [
      { jenis: "MASUK", jumlah: masuk },
      { jenis: "KELUAR", jumlah: keluar },
    ]);

    if (parsed.jenis === "KELUAR" && parsed.jumlah > stokSaatIni) {
      return errorResponse(
        `Stok tidak cukup: tersedia ${stokSaatIni} ${barang.satuan}, keluar ${parsed.jumlah} ${barang.satuan}.`,
        400
      );
    }

    const riwayat = await prisma.riwayatStok.create({
      data: {
        barangId: id,
        jenis: parsed.jenis,
        jumlah: parsed.jumlah,
        keterangan: parsed.keterangan ?? null,
        tanggal: parsed.tanggal ?? new Date(),
      },
    });
    return successResponse(riwayat, "Stok berhasil dicatat", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal mencatat stok", 500);
  }
}