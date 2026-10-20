import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import type { Prisma } from "@/generated/prisma/client";

// GET /api/karir/pelamar - daftar pelamar (SUPER_ADMIN)
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const where: Prisma.PelamarWhereInput = {};
    const status = searchParams.get("status");
    const tipe = searchParams.get("tipe");
    const lowonganId = searchParams.get("lowonganId");
    if (status && ["BARU", "SELEKSI", "INTERVIEW", "DITERIMA", "DITOLAK"].includes(status)) {
      where.status = status as Prisma.EnumStatusPelamarFilter;
    }
    if (tipe === "KERJA" || tipe === "MAGANG") where.tipe = tipe;
    if (lowonganId) where.lowonganId = lowonganId;

    const items = await prisma.pelamar.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { lowongan: { select: { judul: true, divisi: true } } },
    });

    return successResponse(items);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal memuat pelamar", 500);
  }
}
