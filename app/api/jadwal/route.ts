import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, type Role } from "@/lib/auth";
import { createJadwalSchema } from "@/lib/validations/jadwalValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_PERTANIAN"];
const PAGE_SIZE = 20;

// GET /api/jadwal?status=RENCANA&blok=Blok A
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  const query = Object.fromEntries(req.nextUrl.searchParams);
  const status = (query.status || "").trim();
  const blok = (query.blok || "").trim();
  const page = Math.max(1, Number(query.page) || 1);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (blok) where.blok = blok;

  const [total, rows] = await Promise.all([
    prisma.jadwalPerawatan.count({ where }),
    prisma.jadwalPerawatan.findMany({
      where,
      orderBy: [{ tanggalRencana: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        pohon: { select: { id: true, namaPohon: true } },
        createdBy: { select: { nama: true } },
      },
    }),
  ]);

  return successResponse({
    data: rows.map((r) => ({
      id: r.id,
      blok: r.blok,
      pohonId: r.pohonId,
      pohonNama: r.pohon?.namaPohon || null,
      jenis: r.jenis,
      tanggalRencana: r.tanggalRencana.toISOString(),
      status: r.status,
      catatan: r.catatan,
      dibuatOleh: r.createdBy?.nama || "-",
    })),
    page,
    totalPage: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

// POST /api/jadwal - buat jadwal
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;
  const session = auth;

  try {
    const body = await req.json();
    const parsed = createJadwalSchema.parse(body);

    const pohonId = (parsed.pohonId as string) || null;
    if (pohonId) {
      const pohon = await prisma.pohon.findUnique({ where: { id: pohonId } });
      if (!pohon) return errorResponse(`Pohon ${pohonId} tidak ditemukan`, 404);
    }

    const jadwal = await prisma.jadwalPerawatan.create({
      data: {
        blok: parsed.blok,
        pohonId,
        jenis: parsed.jenis,
        tanggalRencana: parsed.tanggalRencana,
        catatan: (parsed.catatan as string) || null,
        createdById: session?.userId ?? null,
      },
    });
    return successResponse(jadwal, "Jadwal dibuat", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal buat jadwal", 500);
  }
}
