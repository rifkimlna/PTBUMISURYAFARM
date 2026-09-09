import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { updateKaryawanSchema } from "@/lib/validations/karyawanValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const data = await prisma.karyawan.findUnique({
    where: { id },
    include: { riwayatGaji: { orderBy: { bulanTahun: "desc" }, take: 12 } },
  });
  if (!data) return errorResponse("Karyawan tidak ditemukan", 404);
  return successResponse(data);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateKaryawanSchema.parse(body);
    const exists = await prisma.karyawan.findUnique({ where: { id } });
    if (!exists) return errorResponse("Karyawan tidak ditemukan", 404);

    const updated = await prisma.karyawan.update({
      where: { id },
      data: {
        ...parsed,
        gajiPokok: parsed.gajiPokok as any,
      },
    });
    return successResponse(updated, "Karyawan diupdate");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const exists = await prisma.karyawan.findUnique({ where: { id } });
  if (!exists) return errorResponse("Karyawan tidak ditemukan", 404);
  await prisma.karyawan.delete({ where: { id } });
  return successResponse(null, "Karyawan dihapus");
}
