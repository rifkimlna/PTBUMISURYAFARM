import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { z } from "zod";

const createAkunSchema = z.object({
  nama: z.string().min(2, "Nama akun minimal 2 karakter").max(100),
  kelompok: z.enum(["Aset", "Kewajiban", "Modal", "Pendapatan", "Beban"]),
  golongan: z.string().min(2, "Golongan wajib diisi").max(100),
  deskripsi: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
}).refine((data) => {
  const validGolongan: Record<string, string[]> = {
    Aset: ["Kas & Setara", "Piutang Usaha", "Persediaan", "Aset Tetap"],
    Kewajiban: ["Utang"],
    Modal: ["Modal", "Laba Ditahan"],
    Pendapatan: ["Pendapatan Usaha", "Pendapatan Lainnya"],
    Beban: [
      "Beban Tenaga Kerja",
      "Beban Produksi",
      "Beban Perlengkapan & Peralatan",
      "Beban Operasional",
      "Pelunasan Hutang",
    ],
  };
  const allowed = validGolongan[data.kelompok] || [];
  return allowed.includes(data.golongan);
}, {
  message: "Kombinasi Kelompok dan Golongan tidak valid",
  path: ["golongan"],
});

const querySchema = z.object({
  kelompok: z.enum(["Aset", "Kewajiban", "Modal", "Pendapatan", "Beban"]).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

// Auto-generate kode based on kelompok + golongan sequence
async function generateKode(prisma: any, kelompok: string, _golongan: string): Promise<string> {
  const kelompokPrefix: Record<string, string> = {
    Aset: "1",
    Kewajiban: "2",
    Modal: "3",
    Pendapatan: "4",
    Beban: "5",
  };

  const prefix = kelompokPrefix[kelompok] || "9";

  // Find the highest existing kode for this kelompok
  const existing = await prisma.akunCOA.findMany({
    where: {
      kode: { startsWith: prefix },
    },
    select: { kode: true },
    orderBy: { kode: "desc" },
    take: 1,
  });

  let nextNum = 1;
  if (existing.length > 0) {
    const lastKode = existing[0].kode;
    const numPart = parseInt(lastKode.slice(1), 10);
    if (!isNaN(numPart)) {
      nextNum = numPart + 1;
    }
  }

  // Ensure 4 digits
  return `${prefix}${nextNum.toString().padStart(3, "0")}`;
}

// GET /api/keuangan/coa - list all COA
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const query = querySchema.parse({
      kelompok: searchParams.get("kelompok") || undefined,
      isActive: searchParams.get("isActive") || undefined,
      search: searchParams.get("search") || undefined,
    });

    const where: any = {};
    if (query.kelompok) where.kelompok = query.kelompok;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { kode: { contains: query.search, mode: "insensitive" } },
        { nama: { contains: query.search, mode: "insensitive" } },
        { golongan: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const data = await prisma.akunCOA.findMany({
      where,
      orderBy: [{ kelompok: "asc" }, { golongan: "asc" }, { kode: "asc" }],
      include: { createdBy: { select: { id: true, nama: true } } },
    });

    return successResponse(data);
  } catch (e) {
    if (e instanceof z.ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil daftar akun", 500);
  }
}

// POST /api/keuangan/coa - create new akun
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = createAkunSchema.parse(body);

    // Generate kode automatically
    const kode = await generateKode(prisma, parsed.kelompok, parsed.golongan);

    // Determine tipe based on kelompok
    const tipeMap: Record<string, "PEMASUKAN" | "PENGELUARAN" | "NETRAL"> = {
      Aset: "NETRAL",
      Kewajiban: "NETRAL",
      Modal: "NETRAL",
      Pendapatan: "PEMASUKAN",
      Beban: "PENGELUARAN",
    };

    const akun = await prisma.akunCOA.create({
      data: {
        kode,
        nama: parsed.nama,
        kelompok: parsed.kelompok,
        golongan: parsed.golongan,
        tipe: tipeMap[parsed.kelompok],
        deskripsi: parsed.deskripsi ?? null,
        isActive: parsed.isActive,
        createdById: session.userId,
      },
      include: { createdBy: { select: { id: true, nama: true } } },
    });

    return successResponse(akun, "Akun COA berhasil ditambahkan", 201);
  } catch (e) {
    if (e instanceof z.ZodError) return zodErrorResponse(e);
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return errorResponse("Kode atau nama akun sudah digunakan", 400);
    }
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah akun", 500);
  }
}