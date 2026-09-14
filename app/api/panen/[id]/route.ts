import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, type Role } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_PERTANIAN"];

// DELETE /api/panen/[id] - koreksi catatan salah
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const exists = await prisma.panen.findUnique({ where: { id } });
  if (!exists) return errorResponse("Catatan panen tidak ditemukan", 404);

  await prisma.panen.delete({ where: { id } });
  return successResponse(null, "Catatan panen dihapus");
}
