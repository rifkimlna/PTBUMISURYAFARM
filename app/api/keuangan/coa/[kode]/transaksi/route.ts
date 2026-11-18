import { NextRequest } from "next/server";
import { requireAuthAndRole } from "@/lib/auth";
import { getAkunByKodeFromDB } from "@/lib/coa-server";
import { getTransaksiAkun } from "@/lib/coa-transaksi";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kode: string }> }
) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { kode } = await params;
    // Pakai DB agar akun baru dari Daftar Akun langsung bisa dibuka detailnya
    // (sebelumnya pakai data statis sehingga akun baru selalu 404).
    const akun = await getAkunByKodeFromDB(kode);
    if (!akun) {
      return errorResponse("Akun COA tidak ditemukan", 404);
    }

    const { searchParams } = new URL(req.url);
    const query = querySchema.parse({
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    // Satu sumber dengan halaman detail (sudah transfer-aware untuk Kas/Bank/Tabungan).
    const { rows, total, summary } = await getTransaksiAkun(kode, {
      page,
      limit,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    return successResponse({
      data: rows.map((d) => ({
        id: d.id,
        tanggal: d.tanggal,
        transaksi: d.transaksi,
        noTransaksi: d.noTransaksi,
        debit: d.debit,
        kredit: d.kredit,
        saldo: d.saldo,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        totalDebit: summary.totalDebit,
        totalKredit: summary.totalKredit,
        saldoAkhir: summary.saldoAkhir,
      },
      akun: {
        kode: akun.kode,
        nama: akun.nama,
        kelompok: akun.kelompok,
        golongan: akun.golongan,
        tipe: akun.tipe,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil transaksi akun", 500);
  }
}
