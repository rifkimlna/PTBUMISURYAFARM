import { NextRequest } from "next/server";
import { prisma, isDbConnectionError, dbUnreachableMessage } from "@/lib/prisma";
import { requireAuthAndRole, type Role } from "@/lib/auth";
import { createRiwayatStokSchema } from "@/lib/validations/persediaanValidation";
import { hitungStokSaatIni } from "@/lib/persediaan";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_PERTANIAN"];

type Params = { params: Promise<{ id: string }> };

// POST /api/perkebunan/bibit/[id]/stok - penyesuaian stok (opname / koreksi manual)
// Tanpa jurnal keuangan: murni catat keluar-masuk fisik di gudang pembibitan.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = createRiwayatStokSchema.parse(body);

    const barang = await prisma.persediaanBarang.findUnique({
      where: { id: id.toUpperCase() },
      include: { riwayat: { select: { jenis: true, jumlah: true } } },
    });
    if (!barang || barang.kategori !== "Bibit/Benih") return errorResponse("Bibit tidak ditemukan", 404);

    const stok = hitungStokSaatIni(
      barang.stokAwal,
      barang.riwayat.map((r) => ({ jenis: r.jenis, jumlah: r.jumlah }))
    );
    if (parsed.jenis === "KELUAR" && parsed.jumlah > stok) {
      return errorResponse(`Stok tidak cukup (tersedia ${stok} ${barang.satuan})`, 400);
    }

    const row = await prisma.riwayatStok.create({
      data: {
        barangId: barang.id,
        jenis: parsed.jenis,
        jumlah: parsed.jumlah,
        keterangan: parsed.keterangan ?? null,
        sumber: parsed.sumber ?? "PENYESUAIAN",
        tanggal: parsed.tanggal ?? new Date(),
      },
    });

    const stokBaru = parsed.jenis === "MASUK" ? stok + parsed.jumlah : stok - parsed.jumlah;
    return successResponse({ ...row, stokBaru }, "Stok bibit diupdate", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    if (isDbConnectionError(e)) return errorResponse(dbUnreachableMessage(), 503);
    return errorResponse(e instanceof Error ? e.message : "Gagal update stok", 500);
  }
}
