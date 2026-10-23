import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/pembelian/hutang-tersedia?q= - utang BELUM LUNAS untuk dipilih di Tukar Faktur.
// Menampilkan No. Faktur, deskripsi, tempo, status, jumlah, dan sisa dari data sebenarnya.
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";

    const data = await prisma.tagihan.findMany({
      where: {
        tipe: "HUTANG",
        status: { not: "LUNAS" },
        ...(q ? { pihak: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { jatuhTempo: "asc" },
      take: 50,
      select: {
        id: true,
        pihak: true,
        keterangan: true,
        tanggal: true,
        jatuhTempo: true,
        status: true,
        jumlah: true,
        sisa: true,
        fakturPembelian: { select: { noFaktur: true } },
      },
    });

    return successResponse(
      data.map((t) => ({
        id: t.id,
        noFaktur: t.fakturPembelian?.noFaktur ?? null,
        pihak: t.pihak,
        keterangan: t.keterangan,
        tanggal: t.tanggal,
        jatuhTempo: t.jatuhTempo,
        status: t.status,
        jumlah: Number(t.jumlah),
        sisa: Number(t.sisa),
      }))
    );
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil utang", 500);
  }
}
