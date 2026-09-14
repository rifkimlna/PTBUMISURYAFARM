import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, type Role } from "@/lib/auth";
import { updateJadwalSchema } from "@/lib/validations/jadwalValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_PERTANIAN"];

// PUT /api/jadwal/[id] - ubah status/tanggal/catatan
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateJadwalSchema.parse(body);

    const exists = await prisma.jadwalPerawatan.findUnique({ where: { id } });
    if (!exists) return errorResponse("Jadwal tidak ditemukan", 404);

    const data: Record<string, unknown> = {};
    if (parsed.blok !== undefined) data.blok = parsed.blok;
    if (parsed.pohonId !== undefined) {
      const pohonId = (parsed.pohonId as string) || null;
      if (pohonId) {
        const pohon = await prisma.pohon.findUnique({ where: { id: pohonId } });
        if (!pohon) return errorResponse(`Pohon ${pohonId} tidak ditemukan`, 404);
      }
      data.pohonId = pohonId;
    }
    if (parsed.jenis !== undefined) data.jenis = parsed.jenis;
    if (parsed.tanggalRencana !== undefined) data.tanggalRencana = parsed.tanggalRencana;
    if (parsed.status !== undefined) data.status = parsed.status;
    if (parsed.catatan !== undefined) data.catatan = (parsed.catatan as string) || null;

    const updated = await prisma.jadwalPerawatan.update({ where: { id }, data });
    return successResponse(updated, "Jadwal diperbarui");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update jadwal", 500);
  }
}

// DELETE /api/jadwal/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const exists = await prisma.jadwalPerawatan.findUnique({ where: { id } });
  if (!exists) return errorResponse("Jadwal tidak ditemukan", 404);

  await prisma.jadwalPerawatan.delete({ where: { id } });
  return successResponse(null, "Jadwal dihapus");
}
