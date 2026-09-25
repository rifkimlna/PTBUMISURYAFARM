import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

// Status dokumen pembelian: BELUM_DITAGIH <-> SELESAI.
const schema = z.object({
  status: z.enum(["BELUM_DITAGIH", "SELESAI"]),
});

// PATCH /api/pembelian/dokumen/[id]/status - tutup/buka kembali dokumen
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.parse(body);

    const dokumen = await prisma.dokumenPembelian.findUnique({
      where: { id },
      select: { id: true, tipe: true, status: true },
    });
    if (!dokumen) return errorResponse("Dokumen tidak ditemukan", 404);

    const updated = await prisma.dokumenPembelian.update({
      where: { id },
      data: { status: parsed.status },
      select: { id: true, tipe: true, noDokumen: true, status: true },
    });
    return successResponse(updated, `Status dokumen menjadi ${parsed.status}`);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ubah status", 400);
  }
}
