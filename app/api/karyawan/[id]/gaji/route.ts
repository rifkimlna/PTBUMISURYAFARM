import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { createRiwayatGajiSchema } from "@/lib/validations/karyawanValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

// GET /api/karyawan/[id]/gaji - list gaji
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const karyawan = await prisma.karyawan.findUnique({ where: { id } });
  if (!karyawan) return errorResponse("Karyawan tidak ditemukan", 404);

  const data = await prisma.riwayatGaji.findMany({
    where: { karyawanId: id },
    orderBy: { bulanTahun: "desc" },
  });
  return successResponse(data);
}

// POST /api/karyawan/[id]/gaji - input gaji bulanan
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const karyawan = await prisma.karyawan.findUnique({ where: { id } });
  if (!karyawan) return errorResponse("Karyawan tidak ditemukan", 404);

  try {
    const body = await req.json();
    // karyawanId dari params atau body - ensure sama
    const parsed = createRiwayatGajiSchema.parse({ ...body, karyawanId: id });

    const exists = await prisma.riwayatGaji.findUnique({
      where: { karyawanId_bulanTahun: { karyawanId: id, bulanTahun: parsed.bulanTahun } },
    });
    if (exists) return errorResponse(`Gaji bulan ${parsed.bulanTahun} sudah ada`, 409);

    const gaji = await prisma.riwayatGaji.create({
      data: {
        karyawanId: id,
        bulanTahun: parsed.bulanTahun,
        totalGaji: parsed.totalGaji as any,
        status: parsed.status as any,
        tanggalBayar: parsed.tanggalBayar ?? (parsed.status === "SUDAH_DIBAYAR" ? new Date() : null),
      },
    });

    // Jika sudah dibayar, auto buat transaksi pengeluaran
    if (parsed.status === "SUDAH_DIBAYAR") {
      await prisma.transaksiKas.create({
        data: {
          tipe: "PENGELUARAN",
          kategori: "Gaji Karyawan",
          jumlah: parsed.totalGaji as any,
          keterangan: `Gaji ${karyawan.namaLengkap} - ${parsed.bulanTahun}`,
          adminId: auth.userId,
        },
      });
    }

    return successResponse(gaji, "Riwayat gaji ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah gaji", 500);
  }
}
