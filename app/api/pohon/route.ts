import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { createPohonSchema, queryPohonSchema } from "@/lib/validations/pohonValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

// GET /api/pohon - list (SUPER_ADMIN, ADMIN_PERTANIAN)
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_PERTANIAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const query = queryPohonSchema.parse({
      lokasiBlok: searchParams.get("lokasiBlok") || undefined,
      status: searchParams.get("status") || undefined,
      varietas: searchParams.get("varietas") || undefined,
      namaPohon: searchParams.get("namaPohon") || undefined,
      jenis: searchParams.get("jenis") || undefined,
      koordinat: searchParams.get("koordinat") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.lokasiBlok) where.lokasiBlok = { contains: query.lokasiBlok, mode: "insensitive" };
    if (query.status) where.status = query.status;
    if (query.varietas) where.varietas = { contains: query.varietas, mode: "insensitive" };
    if (query.namaPohon) where.namaPohon = { contains: query.namaPohon, mode: "insensitive" };
    if (query.jenis) where.jenis = { contains: query.jenis, mode: "insensitive" };
    if (query.koordinat) where.koordinat = { contains: query.koordinat, mode: "insensitive" };

    const [data, total] = await Promise.all([
      prisma.pohon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { riwayat: true } } },
      }),
      prisma.pohon.count({ where }),
    ]);

    return successResponse(
      { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      "Daftar pohon"
    );
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil data pohon", 500);
  }
}

// POST /api/pohon - create (SUPER_ADMIN, ADMIN_PERTANIAN)
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_PERTANIAN"]);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = createPohonSchema.parse(body);

    const exists = await prisma.pohon.findUnique({ where: { id: parsed.id } });
    if (exists) return errorResponse(`ID pohon ${parsed.id} sudah ada`, 409);

    const pohon = await prisma.pohon.create({
      data: {
        id: parsed.id,
        namaPohon: (parsed.namaPohon as string) || null,
        varietas: parsed.varietas,
        jenis: (parsed.jenis as string) || null,
        lokasiBlok: parsed.lokasiBlok,
        tanggalTanam: parsed.tanggalTanam,
        koordinat: (parsed.koordinat as string) || null,
        hasilPanen: (parsed.hasilPanen as any) ?? null,
        pemupukan: (parsed.pemupukan as string) || null,
        pengobatan: (parsed.pengobatan as string) || null,
        status: parsed.status as any,
      },
    });

    return successResponse(pohon, "Pohon berhasil ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah pohon", 500);
  }
}
