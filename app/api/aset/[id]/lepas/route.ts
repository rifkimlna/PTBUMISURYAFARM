import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { lepasAsetSchema } from "@/lib/validations/keuanganValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// POST /api/aset/[id]/lepas - catat penjualan/pelepasan aset aktif.
// Hanya pencatatan (untung/rugi tampil di halaman); tanpa Kas otomatis agar
// tidak tercipta transaksi palsu. Batalkan lewat PUT statusAset? Tidak —
// gunakan endpoint /aktifkan-kembali di bawah bila salah input.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  void session;
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = lepasAsetSchema.parse(body);
    const exists = await prisma.aset.findUnique({ where: { id } });
    if (!exists) return errorResponse("Aset tidak ditemukan", 404);
    if (exists.statusAset !== "AKTIF") {
      return errorResponse("Hanya aset aktif yang dapat dijual/dilepas", 400);
    }
    if (parsed.cara === "DIJUAL" && !(parsed.hargaJual && parsed.hargaJual > 0)) {
      return errorResponse("Harga jual wajib diisi untuk penjualan aset", 400);
    }

    const updated = await prisma.aset.update({
      where: { id },
      data: {
        statusAset: parsed.cara,
        caraLepas: parsed.cara,
        tanggalLepas: parsed.tanggal ?? new Date(),
        hargaJual: (parsed.hargaJual ?? null) as never,
        noTransaksiLepas: parsed.noTransaksi?.trim() || null,
        keteranganLepas: parsed.keterangan?.trim() || null,
      },
    });
    return successResponse(updated, parsed.cara === "DIJUAL" ? "Penjualan aset dicatat" : "Pelepasan aset dicatat");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal mencatat pelepasan", 500);
  }
}

// DELETE /api/aset/[id]/lepas - batalkan pencatatan jual/lepas (kembali AKTIF).
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const exists = await prisma.aset.findUnique({ where: { id } });
  if (!exists) return errorResponse("Aset tidak ditemukan", 404);
  if (exists.statusAset !== "DIJUAL" && exists.statusAset !== "DILEPAS") {
    return errorResponse("Aset tidak dalam status dijual/dilepas", 400);
  }

  const updated = await prisma.aset.update({
    where: { id },
    data: {
      statusAset: "AKTIF",
      caraLepas: null,
      tanggalLepas: null,
      hargaJual: null,
      noTransaksiLepas: null,
      keteranganLepas: null,
    },
  });
  return successResponse(updated, "Aset dikembalikan aktif");
}
