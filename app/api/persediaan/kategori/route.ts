import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { kategoriPersediaanList } from "@/lib/validations/persediaanValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

// GET /api/persediaan/kategori - daftar kategori + jumlah produk + akun COA.
// Kategori mengikuti pembukuan (3 nilai baku); Atur = ganti nama massal.
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const agg = await prisma.persediaanBarang.groupBy({
    by: ["kategori"],
    _count: { id: true },
    orderBy: { kategori: "asc" },
  });

  return successResponse(
    agg.map((a) => ({
      kategori: a.kategori,
      jumlahProduk: a._count.id,
      baku: (kategoriPersediaanList as readonly string[]).includes(a.kategori),
    }))
  );
}

const renameSchema = z.object({
  dari: z.string().trim().min(1, "Kategori asal wajib diisi").max(50),
  ke: z.string().trim().min(2, "Nama kategori minimal 2 karakter").max(50),
});

// PUT /api/persediaan/kategori - ganti nama kategori untuk semua produknya.
// Hati-hati: kategori baku (3 nilai) terhubung mapping COA persediaan;
// menggantinya membuat produk memakai akun Beban 5402 saat difaktur.
export async function PUT(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = renameSchema.parse(body);
    if (parsed.dari === parsed.ke) return errorResponse("Nama kategori sama", 400);

    const ada = await prisma.persediaanBarang.count({ where: { kategori: parsed.dari } });
    if (ada === 0) return errorResponse(`Kategori "${parsed.dari}" tidak ditemukan`, 404);

    const hasil = await prisma.persediaanBarang.updateMany({
      where: { kategori: parsed.dari },
      data: { kategori: parsed.ke },
    });
    return successResponse(
      { diubah: hasil.count },
      `${hasil.count} produk dipindah ke kategori "${parsed.ke}"`
    );
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ubah kategori", 500);
  }
}
