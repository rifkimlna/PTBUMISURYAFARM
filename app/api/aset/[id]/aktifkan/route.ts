import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// POST /api/aset/[id]/aktifkan - TERTUNDA -> AKTIF (tanpa jurnal baru;
// jurnal akuisisi sudah tercatat saat tambah aset).
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  void session;
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const exists = await prisma.aset.findUnique({ where: { id } });
    if (!exists) return errorResponse("Aset tidak ditemukan", 404);
    if (exists.statusAset === "AKTIF") return errorResponse("Aset sudah aktif", 400);
    if (exists.statusAset === "DIJUAL" || exists.statusAset === "DILEPAS") {
      return errorResponse("Aset yang sudah dilepas tidak dapat diaktifkan (buat data baru bila kembali)", 400);
    }

    const updated = await prisma.aset.update({
      where: { id },
      data: {
        statusAset: "AKTIF",
        // Mulai susut default = tanggal akuisisi bila belum diatur.
        ...(exists.metodeSusut && exists.metodeSusut !== "NON_DEP" && !exists.tanggalMulaiSusut
          ? { tanggalMulaiSusut: exists.tanggalAkuisisi ?? exists.tanggalPerolehan ?? new Date() }
          : {}),
      },
    });
    return successResponse(updated, "Aset diaktifkan");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal mengaktifkan aset", 500);
  }
}
