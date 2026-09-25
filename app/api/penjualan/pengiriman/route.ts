import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest, requireAuthAndRole } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({
  pesananId: z.string(),
  alamatPengiriman: z.string().optional(),
  tanggalPengiriman: z.coerce.date().optional(),
  noTransaksi: z.string().max(50).optional(),
  noRefPelanggan: z.string().max(50).optional(),
  kirimMelalui: z.string().max(100).optional(),
  noPelacakan: z.string().max(100).optional(),
  gudang: z.string().max(100).optional(),
  pesan: z.string().max(1000).optional(),
  memo: z.string().max(1000).optional(),
  lampiran: z
    .array(
      z.object({
        fileName: z.string(),
        fileUrl: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
      })
    )
    .max(20)
    .optional(),
});

// GET /api/penjualan/pengiriman - daftar pengiriman nyata (tanpa transaksi keuangan)
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const pesananId = searchParams.get("pesananId")?.trim() || "";

  const data = await prisma.pengirimanPenjualan.findMany({
    where: {
      ...(pesananId ? { pesananId } : {}),
      ...(q
        ? {
            OR: [
              { noPengiriman: { contains: q, mode: "insensitive" } },
              { pelanggan: { nama: { contains: q, mode: "insensitive" } } },
              { pesanan: { noDokumen: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      pelanggan: { select: { id: true, nama: true } },
      pesanan: { select: { id: true, noDokumen: true } },
      _count: { select: { items: true } },
    },
  });

  return successResponse(
    data.map((p) => ({
      id: p.id,
      noPengiriman: p.noPengiriman,
      pesananId: p.pesananId,
      pesananNo: p.pesanan.noDokumen,
      pelangganId: p.pelangganId,
      pelangganNama: p.pelanggan.nama,
      tanggalPengiriman: p.tanggalPengiriman?.toISOString() ?? null,
      kirimMelalui: p.kirimMelalui,
      gudang: p.gudang,
      jumlahItem: p._count.items,
      createdAt: p.createdAt.toISOString(),
    }))
  );
}

// POST /api/penjualan/pengiriman - buat pengiriman dari Pesanan.
// Data pelanggan & produk diambil dari Pesanan asal (bukan input ulang).
// TIDAK membuat transaksi keuangan/pemasukan, TIDAK menyentuh Kas/Piutang/COA.
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
    const data = schema.parse(body);
    const pesanan = await prisma.dokumenPenjualan.findUnique({
      where: { id: data.pesananId },
      include: { pelanggan: true, items: true },
    });
    if (!pesanan || pesanan.tipe !== "PESANAN") return errorResponse("Pesanan tidak ditemukan", 404);
    if (pesanan.items.length === 0) return errorResponse("Pesanan tidak memiliki item produk", 400);
    const noPengiriman = `PENG-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    const noTransaksi =
      data.noTransaksi?.trim() ||
      `TRX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;
    const pengiriman = await prisma.$transaction(async (tx) => {
      const created = await tx.pengirimanPenjualan.create({
        data: {
          noPengiriman,
          pesananId: data.pesananId,
          pelangganId: pesanan.pelangganId,
          alamatPengiriman: data.alamatPengiriman ?? pesanan.alamat,
          tanggalPengiriman: data.tanggalPengiriman ?? new Date(),
          noTransaksi,
          noRefPelanggan: data.noRefPelanggan ?? pesanan.noRefPelanggan,
          kirimMelalui: data.kirimMelalui,
          noPelacakan: data.noPelacakan,
          gudang: data.gudang,
          pesan: data.pesan ?? pesanan.pesan,
          memo: data.memo ?? pesanan.memo,
          adminId: adminId!,
          items: {
            create: pesanan.items.map((it) => ({
              deskripsi: it.deskripsi,
              kuantitas: it.kuantitas,
              unit: it.unit,
              harga: it.harga,
              jumlah: it.jumlah,
            })),
          },
          lampiran: data.lampiran ? { create: data.lampiran } : undefined,
        },
        include: { items: true },
      });
      // Pesanan yang sudah dikirim tidak lagi "Belum Ditagih" di tab Pesanan.
      await tx.dokumenPenjualan.updateMany({
        where: { id: data.pesananId, tipe: "PESANAN", status: { not: "SELESAI" } },
        data: { status: "SELESAI" },
      });
      return created;
    });
    return successResponse(pengiriman, "Pengiriman dibuat", 201);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal buat pengiriman", 400);
  }
}
