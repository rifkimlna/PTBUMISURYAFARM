import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

// Status dokumen non-penagihan (Pesanan/Penawaran): TERBUKA <-> DITUTUP/SELESAI.
// Penagihan tidak diubah lewat sini (status bayarnya milik Tagihan).
const schema = z.object({
  status: z.enum(["TERBUKA", "DITUTUP", "SELESAI"]),
});

// PATCH /api/penjualan/dokumen/[id]/status - tutup/buka kembali pesanan/penawaran
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.parse(body);

    const dokumen = await prisma.dokumenPenjualan.findUnique({
      where: { id },
      select: { id: true, tipe: true, status: true },
    });
    if (!dokumen) return errorResponse("Dokumen tidak ditemukan", 404);
    if (dokumen.tipe !== "PESANAN" && dokumen.tipe !== "PENAWARAN") {
      return errorResponse("Hanya pesanan/penawaran yang bisa ditutup", 400);
    }

    const updated = await prisma.dokumenPenjualan.update({
      where: { id },
      data: { status: parsed.status },
      select: { id: true, tipe: true, noDokumen: true, status: true },
    });
    return successResponse(updated, `Status dokumen menjadi ${parsed.status}`);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ubah status", 400);
  }
}
