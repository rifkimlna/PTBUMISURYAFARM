import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { deleteBuktiFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

// GET /api/pembelian/pengiriman/[id] - detail penerimaan + item nyata
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const data = await prisma.pengirimanPembelian.findUnique({
    where: { id },
    include: {
      supplier: true,
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

// DELETE /api/pembelian/pengiriman/[id] - hapus penerimaan (tanpa efek keuangan)
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const data = await prisma.pengirimanPembelian.findUnique({
    where: { id },
    select: { id: true, pesananId: true },
  });
  if (!data) return errorResponse("Pengiriman tidak ditemukan", 404);

  const lampiran = await prisma.pengirimanBeliLampiran.findMany({
    where: { pengirimanId: id },
    select: { fileUrl: true },
  });

  await prisma.pengirimanPembelian.delete({ where: { id } });
  for (const l of lampiran) {
    await deleteBuktiFile(l.fileUrl);
  }

  // Kembalikan pesanan ke Belum Ditagih bila sudah tidak ada penerimaan lain
  // dan belum ada faktur yang merujuknya.
  const [sisaKirim, fakturTerkait] = await Promise.all([
    prisma.pengirimanPembelian.count({ where: { pesananId: data.pesananId } }),
    prisma.fakturPembelian.count({ where: { referensiIds: { has: data.pesananId } } }),
  ]);
  if (sisaKirim === 0 && fakturTerkait === 0) {
    await prisma.dokumenPembelian.updateMany({
      where: { id: data.pesananId, tipe: "PESANAN" },
      data: { status: "BELUM_DITAGIH" },
    });
  }
  return successResponse(null, "Pengiriman dihapus");
}
