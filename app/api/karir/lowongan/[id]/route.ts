import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

const patchSchema = z.object({
  judul: z.string().min(3).optional(),
  divisi: z.string().min(2).optional(),
  lokasi: z.string().min(2).optional(),
  tipe: z.enum(["KERJA", "MAGANG"]).optional(),
  deskripsi: z.string().min(1).optional(),
  kualifikasi: z.string().min(1).optional(),
  deadline: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// PATCH /api/karir/lowongan/[id] - update lowongan (SUPER_ADMIN)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const data = patchSchema.parse(await req.json());
    const item = await prisma.lowongan.update({
      where: { id },
      data: { ...data, deadline: data.deadline !== undefined ? (data.deadline ? new Date(data.deadline) : null) : undefined },
    });
    return successResponse(item, "Lowongan diperbarui");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal memperbarui lowongan", 500);
  }
}

// DELETE /api/karir/lowongan/[id] - hapus lowongan (SUPER_ADMIN)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    await prisma.lowongan.delete({ where: { id } });
    return successResponse(null, "Lowongan dihapus");
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal menghapus lowongan", 500);
  }
}
