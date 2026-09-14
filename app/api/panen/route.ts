import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, type Role } from "@/lib/auth";
import { createPanenSchema } from "@/lib/validations/panenValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_PERTANIAN"];
const PAGE_SIZE = 20;

// GET /api/panen?bulan=YYYY-MM&blok=A&q=PHN&page=1
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  const query = Object.fromEntries(req.nextUrl.searchParams);
  const bulan = (query.bulan || "").trim();
  const blok = (query.blok || "").trim();
  const q = (query.q || "").trim();
  const page = Math.max(1, Number(query.page) || 1);

  const where: Record<string, unknown> = {};
  if (bulan && /^\d{4}-\d{2}$/.test(bulan)) {
    const [y, m] = bulan.split("-").map(Number);
    where.tanggalPanen = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (blok) where.pohon = { lokasiBlok: blok };
  if (q) {
    where.OR = [
      { pohonId: { contains: q, mode: "insensitive" } },
      { catatan: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows, agg] = await Promise.all([
    prisma.panen.count({ where }),
    prisma.panen.findMany({
      where,
      orderBy: { tanggalPanen: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        pohon: { select: { id: true, lokasiBlok: true, varietas: true } },
        petugas: { select: { nama: true } },
      },
    }),
    prisma.panen.aggregate({ where, _sum: { jumlahKg: true } }),
  ]);

  return successResponse({
    data: rows.map((r) => ({
      id: r.id,
      pohonId: r.pohonId,
      blok: r.pohon.lokasiBlok,
      varietas: r.pohon.varietas,
      tanggalPanen: r.tanggalPanen.toISOString(),
      jumlahKg: Number(r.jumlahKg),
      petugasNama: r.petugas?.nama || "-",
      catatan: r.catatan,
    })),
    summary: { totalKg: Number(agg._sum.jumlahKg ?? 0), count: total },
    page,
    totalPage: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

// POST /api/panen - catat panen susulan/manual
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;
  const session = auth;

  try {
    const body = await req.json();
    const parsed = createPanenSchema.parse(body);

    const pohon = await prisma.pohon.findUnique({ where: { id: parsed.pohonId } });
    if (!pohon) return errorResponse(`Pohon ${parsed.pohonId} tidak ditemukan`, 404);

    const panen = await prisma.panen.create({
      data: {
        pohonId: parsed.pohonId,
        tanggalPanen: parsed.tanggalPanen ?? new Date(),
        jumlahKg: parsed.jumlahKg as never,
        petugasId: session?.userId ?? null,
        catatan: (parsed.catatan as string) || null,
      },
    });

    // samakan snapshot pohon dengan catatan terbaru
    try {
      await prisma.pohon.update({
        where: { id: parsed.pohonId },
        data: { hasilPanen: parsed.jumlahKg as never },
      });
    } catch {}

    return successResponse(panen, "Panen tercatat", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal catat panen", 500);
  }
}
