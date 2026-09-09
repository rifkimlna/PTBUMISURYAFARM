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
      data: { ...parsed } as unknown as Prisma.AsetUpdateInput,
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
  await prisma.aset.delete({ where: { id } });
  return successResponse(null, "Aset dihapus");
}