import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, type Role } from "@/lib/auth";
import { updateBlokSchema } from "@/lib/validations/blokValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_PERTANIAN"];

// PUT /api/blok/[id] - ubah nama/luas
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateBlokSchema.parse(body);

    const exists = await prisma.blok.findUnique({ where: { id } });
    if (!exists) return errorResponse("Blok tidak ditemukan", 404);

    if (parsed.nama && parsed.nama !== exists.nama) {
      const dipakai = await prisma.blok.findUnique({ where: { nama: parsed.nama } });
      if (dipakai) return errorResponse("Nama blok sudah dipakai", 409);
      await prisma.pohon.updateMany({ where: { lokasiBlok: exists.nama }, data: { lokasiBlok: parsed.nama } });
    }

    const updated = await prisma.blok.update({ where: { id }, data: parsed });
    return successResponse(updated, "Blok diperbarui");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update blok", 500);
  }
}

// DELETE /api/blok/[id] - hapus bila tidak dipakai pohon
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const exists = await prisma.blok.findUnique({ where: { id } });
  if (!exists) return errorResponse("Blok tidak ditemukan", 404);

  const dipakai = await prisma.pohon.count({ where: { lokasiBlok: exists.nama } });
  if (dipakai > 0) return errorResponse(`Blok dipakai ${dipakai} pohon, tidak bisa dihapus`, 409);

  await prisma.blok.delete({ where: { id } });
  return successResponse(null, "Blok dihapus");
}
