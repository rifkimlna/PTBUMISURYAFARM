import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { updateTransaksiKasSchema, type TipeTransaksi } from "@/lib/validations/keuanganValidation";
import { kodeAkunByNama, SUMBER_DANA_KODE_MAP } from "@/lib/coa";
import { getKodeAkunByNamaFromDB } from "@/lib/coa-server";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { deleteBuktiFile } from "@/lib/storage";
import { ZodError } from "zod";
import type { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

// Hitung ulang sisa + status tagihan dari pembayaran kas yang masih ada.
// Dipakai setelah ubah/hapus transaksi kas tertaut agar tagihan tidak basi
// (cerminan logika catat-pembayaran di PUT /api/tagihan/[id]).
async function sinkronTagihan(tx: Prisma.TransactionClient, tagihanId: string) {
  const tagihan = await tx.tagihan.findUnique({ where: { id: tagihanId } });
  if (!tagihan) return;
  const pembayaran = await tx.transaksiKas.findMany({
    where: { tagihanId },
    select: { jumlah: true },
  });
  const terbayar = pembayaran.reduce((s, p) => s + Number(p.jumlah), 0);
  const jumlah = Number(tagihan.jumlah);
  const sisaBaru = Math.round((jumlah - terbayar) * 100) / 100;
  const lunas = sisaBaru <= 0.005;
  const sebagian = !lunas && terbayar > 0.005;
  await tx.tagihan.update({
    where: { id: tagihanId },
    data: {
      sisa: lunas ? 0 : Math.max(0, sisaBaru),
      status: lunas ? "LUNAS" : sebagian ? "LUNAS_SEBAGIAN" : "BELUM_LUNAS",
    },
  });
}

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
      const resolvedKategori = kategori ?? exists.kategori;
      
      let resolvedKodeAkun: string | null = null;
      if (resolvedTipe === "TRANSFER") {
        // Untuk transfer, gunakan kode sumber dana dari enum
        resolvedKodeAkun = null;
        // Jika sumberDanaTujuan diupdate, validasi beda dari sumberDana
        if (rest.sumberDanaTujuan !== undefined && exists.sumberDanaTujuan !== rest.sumberDanaTujuan) {
          // validasi sudah dilakukan di schema refine
        }
      } else {
        // Statis dulu, lalu DB agar akun baru dari Daftar Akun ikut tersimpan.
        resolvedKodeAkun =
          kodeAkunByNama(resolvedTipe as any, resolvedKategori ?? exists.kategori) ??
          (await getKodeAkunByNamaFromDB(
            resolvedKategori ?? exists.kategori,
            resolvedTipe as any
          ));
      }
      
      const result = await tx.transaksiKas.update({
        where: { id },
        data: {
          ...(rest.tanggal !== undefined ? { tanggal: rest.tanggal } : {}),
          ...(rest.keterangan !== undefined ? { keterangan: rest.keterangan } : {}),
          ...(rest.jumlah !== undefined ? { jumlah: rest.jumlah } : {}),
          ...(rest.sumberDana !== undefined ? { sumberDana: rest.sumberDana } : {}),
          ...(rest.sumberDanaTujuan !== undefined ? { sumberDanaTujuan: rest.sumberDanaTujuan } : {}),
          ...(rest.noTransaksi !== undefined
            ? { noTransaksi: rest.noTransaksi?.trim() || null }
            : {}),
          ...(rest.pihak !== undefined ? { pihak: rest.pihak?.trim() || null } : {}),
          ...(rest.tag !== undefined ? { tag: rest.tag?.trim() || null } : {}),
          ...(rest.deskripsi !== undefined ? { deskripsi: rest.deskripsi?.trim() || null } : {}),
          ...(resolvedTipe !== undefined || resolvedKategori !== undefined
            ? {
                tipe: resolvedTipe,
                kategori: resolvedKategori,
                kodeAkun: resolvedKodeAkun,
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
      // Nominal pembayaran bisa berubah -> hitung ulang sisa/status tagihan tertaut.
      if (exists.tagihanId) {
        await sinkronTagihan(tx, exists.tagihanId);
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

  // Hapus dalam transaksi: bila baris ini pembayaran tagihan, sisa/status
  // tagihan dihitung ulang dari pembayaran yang tersisa (tidak basi).
  await prisma.$transaction(async (tx) => {
    await tx.transaksiKas.delete({ where: { id } });
    if (exists.tagihanId) {
      await sinkronTagihan(tx, exists.tagihanId);
    }
  });

  for (const row of buktiRows) {
    await deleteBuktiFile(row.fileUrl);
  }

  return successResponse(null, "Transaksi dihapus");
}