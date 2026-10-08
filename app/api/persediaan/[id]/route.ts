import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { updatePersediaanBarangSchema } from "@/lib/validations/persediaanValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const barang = await prisma.persediaanBarang.findUnique({
    where: { id },
    include: {
      riwayat: { orderBy: { tanggal: "desc" }, take: 200 },
    },
  });
  if (!barang) return errorResponse("Barang tidak ditemukan", 404);

  return successResponse({
    ...barang,
    hargaSatuan: Number(barang.hargaSatuan),
    hargaBeli: barang.hargaBeli == null ? null : Number(barang.hargaBeli),
    hargaJual: barang.hargaJual == null ? null : Number(barang.hargaJual),
    tipeProduk: barang.tipeProduk ?? "BARANG",
    riwayat: barang.riwayat.map((r) => ({
      id: r.id,
      jenis: r.jenis,
      jumlah: r.jumlah,
      keterangan: r.keterangan,
      sumber: r.sumber,
      tanggal: r.tanggal.toISOString(),
    })),
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updatePersediaanBarangSchema.parse(body);
    const exists = await prisma.persediaanBarang.findUnique({ where: { id } });
    if (!exists) return errorResponse("Barang tidak ditemukan", 404);
    if (parsed.barcode) {
      const tabrakan = await prisma.persediaanBarang.findFirst({
        where: { barcode: parsed.barcode, id: { not: id } },
        select: { id: true },
      });
      if (tabrakan) return errorResponse(`Barcode ${parsed.barcode} sudah dipakai`, 409);
    }

    const updated = await prisma.persediaanBarang.update({
      where: { id },
      data: {
        ...(parsed.namaBarang !== undefined ? { namaBarang: parsed.namaBarang } : {}),
        ...(parsed.kategori !== undefined ? { kategori: parsed.kategori } : {}),
        ...(parsed.satuan !== undefined ? { satuan: parsed.satuan } : {}),
        // hargaSatuan mengikuti Harga Jual bila dikirim (saran harga form);
        // bila tidak, pakai nilai eksplisit bila ada.
        ...(parsed.hargaJual !== undefined && parsed.hargaJual !== null
          ? { hargaSatuan: parsed.hargaJual }
          : parsed.hargaSatuan !== undefined
            ? { hargaSatuan: parsed.hargaSatuan }
            : {}),
        ...(parsed.keterangan !== undefined ? { keterangan: parsed.keterangan } : {}),
        ...(parsed.barcode !== undefined ? { barcode: parsed.barcode } : {}),
        ...(parsed.tipeProduk !== undefined ? { tipeProduk: parsed.tipeProduk } : {}),
        ...(parsed.hargaBeli !== undefined ? { hargaBeli: parsed.hargaBeli } : {}),
        ...(parsed.hargaJual !== undefined ? { hargaJual: parsed.hargaJual } : {}),
        ...(parsed.batasMinimum !== undefined && parsed.batasMinimum !== null
          ? { batasMinimum: parsed.batasMinimum }
          : {}),
      },
    });
    return successResponse(updated, "Barang diupdate");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update barang", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const exists = await prisma.persediaanBarang.findUnique({ where: { id } });
  if (!exists) return errorResponse("Barang tidak ditemukan", 404);
  await prisma.persediaanBarang.delete({ where: { id } });
  return successResponse(null, "Barang dihapus");
}