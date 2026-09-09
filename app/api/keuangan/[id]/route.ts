import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { updateTransaksiKasSchema } from "@/lib/validations/keuanganValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const data = await prisma.transaksiKas.findUnique({
    where: { id },
    include: { admin: { select: { id: true, nama: true, email: true } } },
  });
  if (!data) return errorResponse("Transaksi tidak ditemukan", 404);
  return successResponse(data);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateTransaksiKasSchema.parse(body);
    const exists = await prisma.transaksiKas.findUnique({ where: { id } });
    if (!exists) return errorResponse("Transaksi tidak ditemukan", 404);

    const updated = await prisma.transaksiKas.update({
      where: { id },
      data: {
        ...parsed,
        jumlah: parsed.jumlah as any,
      } as any,
    });
    return successResponse(updated, "Transaksi diupdate");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const exists = await prisma.transaksiKas.findUnique({ where: { id } });
  if (!exists) return errorResponse("Transaksi tidak ditemukan", 404);
  await prisma.transaksiKas.delete({ where: { id } });
  return successResponse(null, "Transaksi dihapus");
}
