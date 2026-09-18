import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { deleteBuktiFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

// GET /api/penjualan/pengiriman/[id] - detail pengiriman + item nyata
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const data = await prisma.pengirimanPenjualan.findUnique({
    where: { id },
    include: {
      pelanggan: true,
      pesanan: { select: { id: true, noDokumen: true, tanggal: true, total: true, status: true } },
      items: { orderBy: { id: "asc" } },
      lampiran: { orderBy: { createdAt: "asc" } },
      admin: { select: { id: true, nama: true } },
    },
  });
  if (!data) return errorResponse("Pengiriman tidak ditemukan", 404);

  return successResponse({
    ...data,
    items: data.items.map((it) => ({
      ...it,
      kuantitas: Number(it.kuantitas),
      harga: Number(it.harga),
      jumlah: Number(it.jumlah),
    })),
  });
}

// DELETE /api/penjualan/pengiriman/[id] - hapus pengiriman (tanpa efek keuangan)
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const data = await prisma.pengirimanPenjualan.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!data) return errorResponse("Pengiriman tidak ditemukan", 404);

  const lampiran = await prisma.pengirimanLampiran.findMany({
    where: { pengirimanId: id },
    select: { fileUrl: true },
  });

  await prisma.pengirimanPenjualan.delete({ where: { id } });
  for (const l of lampiran) {
    await deleteBuktiFile(l.fileUrl);
  }
  return successResponse(null, "Pengiriman dihapus");
}
