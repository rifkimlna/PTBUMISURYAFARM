import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { updatePenagihanSchema } from "@/lib/validations/penjualanValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

// PUT /api/penjualan/tagihan/[id] - ubah field penagihan (bukan pembayaran).
// Aturan: total hanya boleh diubah bila belum ada pembayaran tercatat
// (agar sisa tidak rusak); tipe tidak boleh diubah dari PIUTANG.
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updatePenagihanSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const tagihan = await tx.tagihan.findUnique({ where: { id } });
      if (!tagihan) throw new Error("Penagihan tidak ditemukan");
      if (tagihan.tipe !== "PIUTANG") throw new Error("Hanya penagihan piutang yang bisa diubah di sini");

      if (parsed.jumlah !== undefined) {
        const bayarCount = await tx.transaksiKas.count({ where: { tagihanId: id } });
        if (bayarCount > 0) {
          throw new Error("Total tidak bisa diubah karena sudah ada pembayaran tercatat");
        }
      }

      return tx.tagihan.update({
        where: { id },
        data: {
          ...(parsed.pihak !== undefined ? { pihak: parsed.pihak } : {}),
          ...(parsed.keterangan !== undefined ? { keterangan: parsed.keterangan } : {}),
          ...(parsed.jatuhTempo !== undefined ? { jatuhTempo: parsed.jatuhTempo } : {}),
          ...(parsed.noInvoice !== undefined ? { noInvoice: parsed.noInvoice || null } : {}),
          ...(parsed.jenis !== undefined ? { jenis: parsed.jenis } : {}),
          ...(parsed.dokumen !== undefined ? { dokumen: parsed.dokumen } : {}),
          ...(parsed.jumlah !== undefined ? { jumlah: parsed.jumlah, sisa: parsed.jumlah } : {}),
        },
      });
    });

    return successResponse(updated, "Penagihan berhasil diubah");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    if (e instanceof Error && (e.message.includes("Unique constraint") || (e as { code?: string }).code === "P2002")) {
      return errorResponse("No. invoice sudah dipakai penagihan lain", 400);
    }
    return errorResponse(e instanceof Error ? e.message : "Gagal ubah penagihan", 400);
  }
}
