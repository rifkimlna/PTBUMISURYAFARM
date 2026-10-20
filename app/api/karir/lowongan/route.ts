import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

const lowonganSchema = z.object({
  judul: z.string().min(3),
  divisi: z.string().min(2),
  lokasi: z.string().min(2),
  tipe: z.enum(["KERJA", "MAGANG"]),
  deskripsi: z.string().min(1),
  kualifikasi: z.string().min(1),
  deadline: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET /api/karir/lowongan - publik: hanya yang aktif; admin: semua
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const isAdmin = !!session && (session.role === "SUPER_ADMIN" || session.role === "ADMIN_PERTANIAN");
    const { searchParams } = new URL(req.url);

    const where: Record<string, unknown> = {};
    if (!isAdmin) where.isActive = true;
    if (searchParams.get("tipe") === "KERJA" || searchParams.get("tipe") === "MAGANG") {
      where.tipe = searchParams.get("tipe");
    }
    if (!isAdmin && searchParams.get("q")) {
      where.OR = [
        { judul: { contains: searchParams.get("q")!, mode: "insensitive" } },
        { divisi: { contains: searchParams.get("q")!, mode: "insensitive" } },
      ];
    }

    const items = await prisma.lowongan.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: isAdmin ? { _count: { select: { pelamar: true } } } : undefined,
    });

    return successResponse(items);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal memuat lowongan", 500);
  }
}

// POST /api/karir/lowongan - buat lowongan (SUPER_ADMIN)
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const data = lowonganSchema.parse(body);
    const item = await prisma.lowongan.create({
      data: {
        judul: data.judul,
        divisi: data.divisi,
        lokasi: data.lokasi,
        tipe: data.tipe,
        deskripsi: data.deskripsi,
        kualifikasi: data.kualifikasi,
        deadline: data.deadline ? new Date(data.deadline) : null,
        isActive: data.isActive ?? true,
      },
    });
    return successResponse(item, "Lowongan dibuat", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal membuat lowongan", 500);
  }
}
