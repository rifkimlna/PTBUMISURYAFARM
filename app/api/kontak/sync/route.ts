import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { backfillKontak, backfillKaryawan } from "@/lib/kontak-sync";
import { successResponse, errorResponse } from "@/lib/api-response";

// POST /api/kontak/sync - tarik Pelanggan (Penjualan), Supplier (Pembelian),
// dan Karyawan (arsip Data Karyawan) yang sudah ada menjadi Kontak.
// Idempoten, aman diulang.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  void session;

  try {
    const [hasil, hasilKaryawan] = await Promise.all([
      backfillKontak(prisma),
      backfillKaryawan(prisma),
    ]);
    const total =
      hasil.pelangganBaru + hasil.supplierBaru + hasilKaryawan.karyawanBaru + hasilKaryawan.karyawanDitautkan;
    return successResponse(
      { ...hasil, ...hasilKaryawan },
      total === 0
        ? "Semua pelanggan, supplier & karyawan sudah ada di Kontak"
        : `Sinkron selesai: ${hasil.pelangganBaru} pelanggan + ${hasil.supplierBaru} supplier + ${hasilKaryawan.karyawanBaru} karyawan masuk Kontak`
    );
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal sinkron kontak", 500);
  }
}
