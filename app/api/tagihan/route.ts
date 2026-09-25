import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

const TipeTagihanEnum = z.enum(["HUTANG", "PIUTANG"]);
const StatusTagihanEnum = z.enum(["BELUM_LUNAS", "LUNAS_SEBAGIAN", "LUNAS"]);
const queryTagihanSchema = z.object({
  tipe: TipeTagihanEnum.optional(),
  status: StatusTagihanEnum.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

const createTagihanSchema = z.object({
  tipe: TipeTagihanEnum,
  pihak: z.string().trim().min(2, "Nama pihak minimal 2 karakter").max(100),
  keterangan: z.string().trim().max(1000, "Keterangan maksimal 1000 karakter").optional().nullable(),
  jumlah: z
    .number({ message: "Jumlah harus angka" })
    .positive("Jumlah harus positif")
    .min(1000, "Jumlah minimal Rp 1.000")
    .max(10_000_000_000, "Jumlah terlalu besar"),
  tanggal: z.coerce.date({ message: "Tanggal tidak valid" }).optional(),
  jatuhTempo: z.coerce.date({ message: "Jatuh tempo tidak valid" }).optional().nullable(),
  // Persiapan modul Penjualan (opsional; diisi form Penagihan tahap berikut)
  noInvoice: z.string().trim().max(50, "No invoice maksimal 50 karakter").optional().nullable(),
  jenis: z.enum(["HASIL_KEBUN", "TERNAK", "IKAN", "LAINNYA"]).optional().nullable(),
  dokumen: z.enum(["PENAGIHAN", "PROFORMA", "TUKAR_FAKTUR"]).optional().nullable(),
});

// GET /api/tagihan - daftar + ringkasan (SUPER_ADMIN, ADMIN_KEUANGAN)
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const query = queryTagihanSchema.parse({
      tipe: searchParams.get("tipe") || undefined,
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: { tipe?: "HUTANG" | "PIUTANG"; status?: "BELUM_LUNAS" | "LUNAS_SEBAGIAN" | "LUNAS"; pihak?: { contains: string; mode: "insensitive" } } = {};
    if (query.tipe) where.tipe = query.tipe;
    if (query.status) where.status = query.status;
    if (query.search) where.pihak = { contains: query.search, mode: "insensitive" };

    const tujuhHariLagi = new Date();
    tujuhHariLagi.setDate(tujuhHariLagi.getDate() + 7);

    const [data, total, sisaPerTipe, jatuhTempoDekat] = await Promise.all([
      prisma.tagihan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { id: true, nama: true } } },
      }),
      prisma.tagihan.count({ where }),
      prisma.tagihan.groupBy({
        by: ["tipe"],
        where: { status: { not: "LUNAS" } },
        _sum: { sisa: true },
      }),
      prisma.tagihan.count({
        where: {
          status: { not: "LUNAS" },
          jatuhTempo: { not: null, lte: tujuhHariLagi },
        },
      }),
    ]);

    const sisaOf = (tipe: "HUTANG" | "PIUTANG") =>
      Number(sisaPerTipe.find((s) => s.tipe === tipe)?._sum.sisa ?? 0);

    return successResponse({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        totalHutang: sisaOf("HUTANG"),
        totalPiutang: sisaOf("PIUTANG"),
        jatuhTempoDekat,
      },
    });
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil tagihan", 500);
  }
}

// POST /api/tagihan - catat tagihan baru
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  let adminId: string | null = (session as { userId?: string } | null)?.userId || null;
  if (!adminId) {
    const fallback = await prisma.user.findFirst({ select: { id: true } });
    adminId = fallback?.id || null;
  }
  if (!adminId) return errorResponse("Admin tidak ditemukan", 500);

  try {
    const body = await req.json();
    const parsed = createTagihanSchema.parse(body);

    const tagihan = await prisma.tagihan.create({
      data: {
        tipe: parsed.tipe,
        pihak: parsed.pihak,
        keterangan: parsed.keterangan ?? null,
        jumlah: parsed.jumlah,
        sisa: parsed.jumlah,
        tanggal: parsed.tanggal ?? new Date(),
        jatuhTempo: parsed.jatuhTempo ?? null,
        noInvoice: parsed.noInvoice?.trim() || null,
        jenis: parsed.jenis ?? null,
        dokumen: parsed.dokumen ?? null,
        adminId: adminId!,
      },
      include: { admin: { select: { id: true, nama: true } } },
    });

    return successResponse(tagihan, "Tagihan berhasil ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah tagihan", 500);
  }
}
