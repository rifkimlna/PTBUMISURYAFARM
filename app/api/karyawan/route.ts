import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { createKaryawanSchema, queryKaryawanSchema } from "@/lib/validations/karyawanValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

// GET /api/karyawan - SUPER_ADMIN, ADMIN_KEUANGAN only
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const query = queryKaryawanSchema.parse({
      statusKerja: searchParams.get("statusKerja") || undefined,
      jabatan: searchParams.get("jabatan") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      ...(query.statusKerja ? { statusKerja: query.statusKerja } : {}),
      ...(query.jabatan ? { jabatan: { contains: query.jabatan, mode: "insensitive" as const } } : {}),
      ...(query.search
        ? {
            OR: [
              { namaLengkap: { contains: query.search, mode: "insensitive" as const } },
              { id: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.karyawan.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.karyawan.count({ where }),
    ]);

    return successResponse({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil karyawan", 500);
  }
}

// POST /api/karyawan - tanpa login demo
export async function POST(req: NextRequest) {

  try {
    const body = await req.json();
    const parsed = createKaryawanSchema.parse(body);

    const exists = await prisma.karyawan.findUnique({ where: { id: parsed.id } });
    if (exists) return errorResponse(`ID karyawan ${parsed.id} sudah ada`, 409);

    const karyawan = await prisma.karyawan.create({
      data: {
        id: parsed.id,
        namaLengkap: parsed.namaLengkap,
        jabatan: parsed.jabatan,
        statusKerja: parsed.statusKerja,
        gajiPokok: parsed.gajiPokok,
        tanggalMasuk: parsed.tanggalMasuk,
        telepon: parsed.telepon,
        email: parsed.email,
        alamat: parsed.alamat,
        tanggalLahir: parsed.tanggalLahir,
        jenisKelamin: parsed.jenisKelamin,
        divisi: parsed.divisi,
        lokasiKerja: parsed.lokasiKerja,
      },
    });

    return successResponse(karyawan, "Karyawan berhasil ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah karyawan", 500);
  }
}
