import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, type Role } from "@/lib/auth";
import { createBlokSchema } from "@/lib/validations/blokValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_PERTANIAN"];

// GET /api/blok - master blok + jumlah pohon per blok
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  const bloks = await prisma.blok.findMany({ orderBy: { kode: "asc" } });
  const counts = await prisma.pohon.groupBy({ by: ["lokasiBlok"], _count: { _all: true } });
  const map = new Map(counts.map((c) => [c.lokasiBlok, c._count._all]));

  return successResponse(
    bloks.map((b) => ({ ...b, jumlahPohon: map.get(b.nama) ?? 0 }))
  );
}

// POST /api/blok - tambah blok
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = createBlokSchema.parse(body);

    const exists = await prisma.blok.findFirst({
      where: { OR: [{ kode: parsed.kode }, { nama: parsed.nama }] },
    });
    if (exists) return errorResponse("Kode/nama blok sudah dipakai", 409);

    const blok = await prisma.blok.create({ data: parsed });
    return successResponse(blok, "Blok ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah blok", 500);
  }
}
