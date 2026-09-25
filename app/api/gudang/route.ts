import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { createGudangSchema } from "@/lib/validations/gudangValidation";
import { generateKodeGudang } from "@/lib/persediaan";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

const querySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["AKTIF", "NONAKTIF"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100).optional(),
});

// GET /api/gudang - daftar gudang (tanpa Transfer Gudang; PT BST belum butuh)
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const query = querySchema.parse({
      q: searchParams.get("q") || undefined,
      status: searchParams.get("status") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const data = await prisma.gudang.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              OR: [
                { kode: { contains: query.q, mode: "insensitive" } },
                { nama: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { kode: "asc" },
      take: query.limit ?? 100,
    });

    return successResponse(data);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil gudang", 500);
  }
}

// POST /api/gudang - tambah gudang
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = createGudangSchema.parse(body);
    const kode = parsed.kode?.toUpperCase() ?? (await generateKodeGudang(prisma));
    const exists = await prisma.gudang.findUnique({ where: { kode }, select: { id: true } });
    if (exists) return errorResponse(`Kode gudang ${kode} sudah dipakai`, 409);

    const gudang = await prisma.gudang.create({
      data: {
        kode,
        nama: parsed.nama,
        alamat: parsed.alamat ?? null,
        status: parsed.status ?? "AKTIF",
      },
    });
    return successResponse(gudang, "Gudang berhasil ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah gudang", 500);
  }
}
