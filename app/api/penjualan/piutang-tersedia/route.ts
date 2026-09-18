import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET /api/penjualan/piutang-tersedia?q= - piutang BELUM LUNAS untuk dipilih di Tukar Faktur.
// Menampilkan No. Invoice, deskripsi, tempo, status, jumlah, dan sisa dari data sebenarnya.
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";

    const data = await prisma.tagihan.findMany({
      where: {
        tipe: "PIUTANG",
        status: { not: "LUNAS" },
        ...(q ? { pihak: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { jatuhTempo: "asc" },
      take: 50,
      select: {
        id: true,
        noInvoice: true,
        pihak: true,
        keterangan: true,
        tanggal: true,
        jatuhTempo: true,
        status: true,
        jumlah: true,
        sisa: true,
      },
    });

    return successResponse(
      data.map((t) => ({
        ...t,
        jumlah: Number(t.jumlah),
        sisa: Number(t.sisa),
      }))
    );
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil piutang", 500);
  }
}
