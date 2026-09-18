import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { z } from "zod";

const updateAkunSchema = z.object({
  nama: z.string().min(2).max(100).optional(),
  kelompok: z.enum(["Aset", "Kewajiban", "Modal", "Pendapatan", "Beban"]).optional(),
  golongan: z.string().min(2).max(100).optional(),
  deskripsi: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi",
}).refine((data) => {
  if (!data.kelompok || !data.golongan) return true;
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

// GET /api/keuangan/coa/[kode] - get single akun
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kode: string }> }
) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { kode } = await params;
    const akun = await prisma.akunCOA.findUnique({
      where: { kode },
      include: { createdBy: { select: { id: true, nama: true } } },
    });

    if (!akun) {
      return errorResponse("Akun COA tidak ditemukan", 404);
    }

    return successResponse(akun);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil akun", 500);
  }
}

// PUT /api/keuangan/coa/[kode] - update akun
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ kode: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session?.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  try {
    const { kode } = await params;
    const body = await req.json();
    const parsed = updateAkunSchema.parse(body);

    // Check if akun exists
    const existing = await prisma.akunCOA.findUnique({ where: { kode } });
    if (!existing) {
      return errorResponse("Akun COA tidak ditemukan", 404);
    }

    // Prevent changing kode (it's the identifier)
    // Update tipe if kelompok changes
    const tipeMap: Record<string, "PEMASUKAN" | "PENGELUARAN" | "NETRAL"> = {
      Aset: "NETRAL",
      Kewajiban: "NETRAL",
      Modal: "NETRAL",
      Pendapatan: "PEMASUKAN",
      Beban: "PENGELUARAN",
    };

    const updateData: any = { ...parsed };
    if (parsed.kelompok) {
      updateData.tipe = tipeMap[parsed.kelompok];
    }

    const akun = await prisma.akunCOA.update({
      where: { kode },
      data: updateData,
      include: { createdBy: { select: { id: true, nama: true } } },
    });

    return successResponse(akun, "Akun COA berhasil diperbarui");
  } catch (e) {
    if (e instanceof z.ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update akun", 500);
  }
}

// DELETE /api/keuangan/coa/[kode] - delete akun
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ kode: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session?.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  try {
    const { kode } = await params;

    const existing = await prisma.akunCOA.findUnique({ where: { kode } });
    if (!existing) {
      return errorResponse("Akun COA tidak ditemukan", 404);
    }

    // Check if akun is used in transactions
    const usage = await prisma.transaksiKas.count({ where: { kodeAkun: kode } });
    if (usage > 0) {
      return errorResponse(
        `Akun tidak bisa dihapus karena sudah digunakan dalam ${usage} transaksi. Gunakan non-aktif (isActive=false) sebagai gantinya.`,
        400
      );
    }

    await prisma.akunCOA.delete({ where: { kode } });

    return successResponse(null, "Akun COA berhasil dihapus");
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal hapus akun", 500);
  }
}