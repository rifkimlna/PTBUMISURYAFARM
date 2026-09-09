import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { updatePohonSchema } from "@/lib/validations/pohonValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

// GET /api/pohon/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_PERTANIAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const pohon = await prisma.pohon.findUnique({
    where: { id },
    include: { riwayat: { orderBy: { tanggalCek: "desc" }, take: 10, include: { petugas: { select: { id: true, nama: true, email: true } } } } },
  });
  if (!pohon) return errorResponse("Pohon tidak ditemukan", 404);
  return successResponse(pohon);
}

// PUT /api/pohon/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_PERTANIAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updatePohonSchema.parse(body);

    const exists = await prisma.pohon.findUnique({ where: { id } });
    if (!exists) return errorResponse("Pohon tidak ditemukan", 404);

    const updated = await prisma.pohon.update({
      where: { id },
      data: parsed as any,
    });
    return successResponse(updated, "Pohon berhasil diupdate");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update", 500);
  }
}

// DELETE /api/pohon/[id] - SUPER_ADMIN only (pertanian hanya edit)
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const exists = await prisma.pohon.findUnique({ where: { id } });
  if (!exists) return errorResponse("Pohon tidak ditemukan", 404);

  await prisma.pohon.delete({ where: { id } });
  return successResponse(null, "Pohon berhasil dihapus");
}
