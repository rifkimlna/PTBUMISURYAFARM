import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

const patchSchema = z.object({
  status: z.enum(["BARU", "SELEKSI", "INTERVIEW", "DITERIMA", "DITOLAK"]),
});

// PATCH /api/karir/pelamar/[id] - ubah status pelamar (SUPER_ADMIN)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const { status } = patchSchema.parse(await req.json());
    const item = await prisma.pelamar.update({ where: { id }, data: { status } });
    return successResponse(item, "Status pelamar diperbarui");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal memperbarui status", 500);
  }
}

// DELETE /api/karir/pelamar/[id] - hapus pelamar (SUPER_ADMIN)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await prisma.pelamar.delete({ where: { id } });
    return successResponse(null, "Pelamar dihapus");
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menghapus pelamar", 500);
  }
}
