import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { createPelangganSchema } from "@/lib/validations/penjualanValidation";
import { ensureKontakForPelanggan } from "@/lib/kontak-sync";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

const querySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100).optional(),
});

// GET /api/pelanggan - daftar pelanggan (SUPER_ADMIN, ADMIN_KEUANGAN)
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const query = querySchema.parse({
      q: searchParams.get("q") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const data = await prisma.pelanggan.findMany({
      where: query.q
        ? {
            OR: [
              { nama: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
              { telepon: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { nama: "asc" },
      take: query.limit ?? 100,
    });

    return successResponse(data);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil pelanggan", 500);
  }
}

// POST /api/pelanggan - tambah pelanggan (tanpa login demo)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  void session;

  try {
    const body = await req.json();
    const parsed = createPelangganSchema.parse(body);

    const pelanggan = await prisma.pelanggan.create({
      data: {
        nama: parsed.nama,
        email: parsed.email?.trim() || null,
        telepon: parsed.telepon?.trim() || null,
        alamat: parsed.alamat?.trim() || null,
      },
    });

    // Dua arah: pelanggan dari Penjualan otomatis menjadi Kontak PELANGGAN
    // (best-effort; kegagalan sinkron tidak menggagalkan tambah pelanggan).
    try {
      await ensureKontakForPelanggan(prisma, {
        nama: pelanggan.nama,
        email: pelanggan.email,
        telepon: pelanggan.telepon,
        alamat: pelanggan.alamat,
      });
    } catch {
      // abaikan
    }

    return successResponse(pelanggan, "Pelanggan berhasil ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah pelanggan", 500);
  }
}
