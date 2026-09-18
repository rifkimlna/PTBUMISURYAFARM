import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { getAkunByKode } from "@/lib/coa";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// Mapping kode akun sumber dana -> enum sumberDana
const SUMBER_DANA_KODE_MAP: Record<string, "KAS" | "BANK" | "TABUNGAN"> = {
  "1101": "KAS",
  "1103": "BANK",
  "1104": "TABUNGAN",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kode: string }> }
) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { kode } = await params;
    const akun = getAkunByKode(kode);
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
    const skip = (page - 1) * limit;

    // Untuk akun sumber dana (1101 Kas, 1103 Bank, 1104 Tabungan), filter by sumberDana
    // Untuk akun lain, filter by kodeAkun
    // TRANSFER tidak memiliki kode COA, exclude dari detail COA
    const isSumberDanaAkun = kode in SUMBER_DANA_KODE_MAP;
    const where: Prisma.TransaksiKasWhereInput = isSumberDanaAkun
      ? { sumberDana: SUMBER_DANA_KODE_MAP[kode], tipe: { in: ["PEMASUKAN", "PENGELUARAN"] } }
      : { kodeAkun: kode };

    if (query.startDate || query.endDate) {
      where.tanggal = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0);
        where.tanggal.gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.tanggal.lte = end;
      }
    }

    const [data, total, summary] = await Promise.all([
      prisma.transaksiKas.findMany({
        where,
        skip,
        take: limit,
        orderBy: { tanggal: "desc" },
        include: { admin: { select: { id: true, nama: true } }, _count: { select: { bukti: true } } },
      }),
      prisma.transaksiKas.count({ where }),
      prisma.transaksiKas.groupBy({
        by: ["tipe"],
        where,
        _sum: { jumlah: true },
      }),
    ]);

    const totalMasuk = Number(summary.find((s) => s.tipe === "PEMASUKAN")?._sum.jumlah ?? 0);
    const totalKeluar = Number(summary.find((s) => s.tipe === "PENGELUARAN")?._sum.jumlah ?? 0);

    return successResponse({
      data: data.map((d) => ({
        id: d.id,
        tanggal: d.tanggal.toISOString(),
        tipe: d.tipe,
        kategori: d.kategori,
        kodeAkun: d.kodeAkun,
        sumberDana: d.sumberDana,
        jumlah: Number(d.jumlah),
        keterangan: d.keterangan,
        admin: { nama: d.admin.nama },
        buktiCount: d._count.bukti,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        pemasukan: totalMasuk,
        pengeluaran: totalKeluar,
        saldo: totalMasuk - totalKeluar,
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