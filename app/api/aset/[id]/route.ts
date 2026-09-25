import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireAuthAndRole } from "@/lib/auth";
import { updateAsetSchema } from "@/lib/validations/keuanganValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { getSessionFromRequest } = await import("@/lib/auth");
  const session = await getSessionFromRequest(req);
  if (!session) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const data = await prisma.aset.findUnique({ where: { id } });
  if (!data) return errorResponse("Aset tidak ditemukan", 404);
  return successResponse(data);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateAsetSchema.parse(body);
    const exists = await prisma.aset.findUnique({ where: { id } });
    if (!exists) return errorResponse("Aset tidak ditemukan", 404);

    const updated = await prisma.aset.update({
      where: { id },
      data: {
        ...(parsed.namaAset !== undefined ? { namaAset: parsed.namaAset } : {}),
        ...(parsed.jumlah !== undefined ? { jumlah: parsed.jumlah } : {}),
        ...(parsed.kategori !== undefined ? { kategori: parsed.kategori } : {}),
        ...(parsed.kondisi !== undefined ? { kondisi: parsed.kondisi } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.nilaiAset !== undefined ? { nilaiAset: parsed.nilaiAset as unknown as Prisma.AsetUpdateInput["nilaiAset"] } : {}),
        ...(parsed.tanggalPerolehan !== undefined ? { tanggalPerolehan: parsed.tanggalPerolehan } : {}),
        ...(parsed.deskripsi !== undefined ? { deskripsi: parsed.deskripsi } : {}),
        ...(parsed.tags !== undefined ? { tags: parsed.tags } : {}),
        ...(parsed.metodeSusut !== undefined ? { metodeSusut: parsed.metodeSusut } : {}),
        ...(parsed.masaManfaatBulan !== undefined ? { masaManfaatBulan: parsed.masaManfaatBulan } : {}),
        ...(parsed.nilaiResidu !== undefined ? { nilaiResidu: parsed.nilaiResidu as unknown as Prisma.AsetUpdateInput["nilaiResidu"] } : {}),
        ...(parsed.akunBebanSusut !== undefined ? { akunBebanSusut: parsed.akunBebanSusut } : {}),
        ...(parsed.akunAkumulasi !== undefined ? { akunAkumulasi: parsed.akunAkumulasi } : {}),
        ...(parsed.tanggalMulaiSusut !== undefined ? { tanggalMulaiSusut: parsed.tanggalMulaiSusut } : {}),
      },
    });
    return successResponse(updated, "Aset diupdate");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update aset", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const exists = await prisma.aset.findUnique({ where: { id } });
  if (!exists) return errorResponse("Aset tidak ditemukan", 404);
  // Hapus balik jurnal yang dibuat form Tambah Aset (milik kejadian ini saja)
  // agar tidak yatim; jurnal dari modul lain tidak pernah tertaut ke aset.
  await prisma.$transaction(async (tx) => {
    if (exists.tagihanId) {
      await tx.tagihan.deleteMany({ where: { id: exists.tagihanId } });
    }
    if (exists.transaksiKasId) {
      await tx.transaksiKas.deleteMany({ where: { id: exists.transaksiKasId } });
    }
    await tx.aset.delete({ where: { id } });
  });
  return successResponse(null, "Aset dihapus");
}