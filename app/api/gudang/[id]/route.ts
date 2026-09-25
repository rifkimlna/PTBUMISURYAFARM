import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { updateGudangSchema } from "@/lib/validations/gudangValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// PUT /api/gudang/[id] - ubah gudang (nama/alamat/status AKTIF-NONAKTIF)
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateGudangSchema.parse(body);
    const exists = await prisma.gudang.findUnique({ where: { id } });
    if (!exists) return errorResponse("Gudang tidak ditemukan", 404);

    const updated = await prisma.gudang.update({
      where: { id },
      data: {
        ...(parsed.nama !== undefined ? { nama: parsed.nama } : {}),
        ...(parsed.alamat !== undefined ? { alamat: parsed.alamat } : {}),
        ...(parsed.status !== undefined && parsed.status !== null ? { status: parsed.status } : {}),
      },
    });
    return successResponse(updated, "Gudang berhasil diubah");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ubah gudang", 400);
  }
}
