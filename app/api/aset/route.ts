import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { createAsetSchema } from "@/lib/validations/keuanganValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

// Aset - bisa diakses semua role yang login (atau sesuaikan)
export async function GET(req: NextRequest) {
  const { getSessionFromRequest } = await import("@/lib/auth");
  const session = await getSessionFromRequest(req);
  if (!session) return errorResponse("Unauthorized", 401);

  const data = await prisma.aset.findMany({ orderBy: { createdAt: "desc" } });
  const totalNilai = data.reduce((sum, a) => sum + Number(a.nilaiAset) * a.jumlah, 0);
  return successResponse({ data, totalNilai });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = createAsetSchema.parse(body);
    const exists = await prisma.aset.findUnique({ where: { id: parsed.id } });
    if (exists) return errorResponse(`ID aset ${parsed.id} sudah ada`, 409);

    const aset = await prisma.aset.create({
      data: {
        id: parsed.id,
        namaAset: parsed.namaAset,
        jumlah: parsed.jumlah,
        kondisi: parsed.kondisi,
        nilaiAset: parsed.nilaiAset as any,
      },
    });
    return successResponse(aset, "Aset ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah aset", 500);
  }
}
