import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getTagAkunNonLabaRugi } from "@/lib/anggaran-tag-server";

// GET /api/keuangan/anggaran-laba-rugi/akun - daftar akun Pendapatan/Beban
// untuk form Anggaran Laba Rugi. Setiap akun membawa tag non-laba-rugi
// (bila ada) supaya form bisa menyingkirkan akun mutasi kas tanpa daftar kode.

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const [akun, tagAkun] = await Promise.all([
      prisma.akunCOA.findMany({
        where: { isActive: true, kelompok: { in: ["Pendapatan", "Beban"] } },
        orderBy: { kode: "asc" },
        select: { kode: true, nama: true, kelompok: true, golongan: true },
      }),
      getTagAkunNonLabaRugi(),
    ]);

    const data = akun.map((a) => ({ ...a, tag: tagAkun.get(a.kode) ?? null }));
    return successResponse(data);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil daftar akun", 500);
  }
}
