import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { updateTransaksiKasSchema, type TipeTransaksi } from "@/lib/validations/keuanganValidation";
import { kodeAkunByNama } from "@/lib/coa";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { deleteBuktiFile } from "@/lib/storage";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const data = await prisma.transaksiKas.findUnique({
    where: { id },
    include: {
      admin: { select: { id: true, nama: true, email: true } },
      bukti: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!data) return errorResponse("Transaksi tidak ditemukan", 404);
  return successResponse(data);
}

// PUT hanya mengubah field transaksi. Bukti lama tetap tersimpan; field "bukti"
// (opsional) hanya menambah bukti baru dan tidak pernah menghapus yang sudah ada.
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateTransaksiKasSchema.parse(body);
    const exists = await prisma.transaksiKas.findUnique({ where: { id } });
    if (!exists) return errorResponse("Transaksi tidak ditemukan", 404);

    const updated = await prisma.$transaction(async (tx) => {
      const { bukti, tipe, kategori, ...rest } = parsed;
      const resolvedTipe = tipe ?? (exists.tipe as TipeTransaksi);
      const result = await tx.transaksiKas.update({
        where: { id },
        data: {
          ...(rest.tanggal !== undefined ? { tanggal: rest.tanggal } : {}),
          ...(rest.keterangan !== undefined ? { keterangan: rest.keterangan } : {}),
          ...(rest.jumlah !== undefined ? { jumlah: rest.jumlah } : {}),
          ...(rest.sumberDana !== undefined ? { sumberDana: rest.sumberDana } : {}),
          ...(tipe !== undefined || kategori !== undefined
            ? {
                tipe: resolvedTipe,
                kategori: kategori ?? exists.kategori,
                kodeAkun: kodeAkunByNama(resolvedTipe, kategori ?? exists.kategori),
              }
            : {}),
        },
      });
      if (bukti && bukti.length > 0) {
        await tx.buktiTransaksi.createMany({
          data: bukti.map((b) => ({
            transaksiId: id,
            fileName: b.fileName,
            fileUrl: b.fileUrl,
            fileType: b.fileType ?? "application/octet-stream",
            fileSize: b.fileSize ?? 0,
          })),
        });
      }
      return result;
    });

    return successResponse(updated, "Transaksi diupdate");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const exists = await prisma.transaksiKas.findUnique({ where: { id } });
  if (!exists) return errorResponse("Transaksi tidak ditemukan", 404);

  // Hapus baris bukti (cascade) dan file fisiknya agar tidak ada orphan.
  const buktiRows = await prisma.buktiTransaksi.findMany({
    where: { transaksiId: id },
    select: { fileUrl: true },
  });

  await prisma.transaksiKas.delete({ where: { id } });

  for (const row of buktiRows) {
    await deleteBuktiFile(row.fileUrl);
  }

  return successResponse(null, "Transaksi dihapus");
}