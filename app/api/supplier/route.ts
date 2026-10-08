import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { createSupplierSchema } from "@/lib/validations/pembelianValidation";
import { ensureKontakForSupplier } from "@/lib/kontak-sync";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

const querySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100).optional(),
});

// GET /api/supplier - daftar supplier (SUPER_ADMIN, ADMIN_KEUANGAN)
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const query = querySchema.parse({
      q: searchParams.get("q") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const data = await prisma.supplier.findMany({
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
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil supplier", 500);
  }
}

// POST /api/supplier - tambah supplier
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  void session;

  try {
    const body = await req.json();
    const parsed = createSupplierSchema.parse(body);

    const supplier = await prisma.supplier.create({
      data: {
        nama: parsed.nama,
        email: parsed.email?.trim() || null,
        telepon: parsed.telepon?.trim() || null,
        alamat: parsed.alamat?.trim() || null,
      },
    });

    // Dua arah: supplier dari Pembelian otomatis menjadi Kontak SUPPLIER.
    try {
      await ensureKontakForSupplier(prisma, {
        nama: supplier.nama,
        email: supplier.email,
        telepon: supplier.telepon,
        alamat: supplier.alamat,
      });
    } catch {
      // abaikan
    }

    return successResponse(supplier, "Supplier berhasil ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah supplier", 500);
  }
}
