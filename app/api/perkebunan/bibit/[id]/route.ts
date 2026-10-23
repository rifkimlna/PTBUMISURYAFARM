import { NextRequest } from "next/server";
import { prisma, isDbConnectionError, dbUnreachableMessage } from "@/lib/prisma";
import { requireAuthAndRole, type Role } from "@/lib/auth";
import { updatePersediaanBarangSchema } from "@/lib/validations/persediaanValidation";
import { hitungStokSaatIni, tentukanStatusStok } from "@/lib/persediaan";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_PERTANIAN"];

type Params = { params: Promise<{ id: string }> };

async function findBibit(id: string) {
  const b = await prisma.persediaanBarang.findUnique({
    where: { id },
    include: { riwayat: { orderBy: { tanggal: "desc" }, take: 50 } },
  });
  if (!b || b.kategori !== "Bibit/Benih") return null;
  const masuk = b.riwayat.filter((r) => r.jenis === "MASUK").reduce((s, r) => s + r.jumlah, 0);
  const keluar = b.riwayat.filter((r) => r.jenis === "KELUAR").reduce((s, r) => s + r.jumlah, 0);
  const stok = hitungStokSaatIni(b.stokAwal, [
    { jenis: "MASUK", jumlah: masuk },
    { jenis: "KELUAR", jumlah: keluar },
  ]);
  return {
    id: b.id,
    namaBarang: b.namaBarang,
    satuan: b.satuan,
    stokAwal: b.stokAwal,
    stok,
    hargaSatuan: Number(b.hargaSatuan),
    hargaBeli: b.hargaBeli == null ? null : Number(b.hargaBeli),
    hargaJual: b.hargaJual == null ? null : Number(b.hargaJual),
    fotoUrl: b.fotoUrl,
    keterangan: b.keterangan,
    batasMinimum: b.batasMinimum,
    status: tentukanStatusStok(stok),
    createdAt: b.createdAt.toISOString(),
    riwayat: b.riwayat.map((r) => ({
      id: r.id,
      jenis: r.jenis,
      jumlah: r.jumlah,
      keterangan: r.keterangan,
      sumber: r.sumber,
      tanggal: r.tanggal.toISOString(),
    })),
  };
}

// GET /api/perkebunan/bibit/[id] - detail bibit + riwayat stok
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const bibit = await findBibit(id.toUpperCase());
    if (!bibit) return errorResponse("Bibit tidak ditemukan", 404);
    return successResponse(bibit);
  } catch (e) {
    if (isDbConnectionError(e)) return errorResponse(dbUnreachableMessage(), 503);
    return errorResponse(e instanceof Error ? e.message : "Gagal muat bibit", 500);
  }
}

// PUT /api/perkebunan/bibit/[id] - update bibit incl. foto
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updatePersediaanBarangSchema.parse(body);
    const exists = await prisma.persediaanBarang.findUnique({ where: { id: id.toUpperCase() } });
    if (!exists || exists.kategori !== "Bibit/Benih") return errorResponse("Bibit tidak ditemukan", 404);
    // Kategori bibit dikunci - abaikan bila dikirim
    if (parsed.kategori !== undefined && parsed.kategori !== "Bibit/Benih") {
      return errorResponse("Kategori bibit tidak bisa diubah dari modul ini", 400);
    }

    await prisma.persediaanBarang.update({
      where: { id: exists.id },
      data: {
        ...(parsed.namaBarang !== undefined ? { namaBarang: parsed.namaBarang } : {}),
        ...(parsed.satuan !== undefined ? { satuan: parsed.satuan } : {}),
        ...(parsed.hargaJual !== undefined && parsed.hargaJual !== null
          ? { hargaSatuan: parsed.hargaJual }
          : parsed.hargaSatuan !== undefined
            ? { hargaSatuan: parsed.hargaSatuan }
            : {}),
        ...(parsed.keterangan !== undefined ? { keterangan: parsed.keterangan } : {}),
        ...(parsed.fotoUrl !== undefined ? { fotoUrl: parsed.fotoUrl } : {}),
        ...(parsed.hargaBeli !== undefined ? { hargaBeli: parsed.hargaBeli } : {}),
        ...(parsed.hargaJual !== undefined ? { hargaJual: parsed.hargaJual } : {}),
        ...(parsed.batasMinimum !== undefined && parsed.batasMinimum !== null
          ? { batasMinimum: parsed.batasMinimum }
          : {}),
      },
    });
    const bibit = await findBibit(exists.id);
    return successResponse(bibit, "Bibit diupdate");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    if (isDbConnectionError(e)) return errorResponse(dbUnreachableMessage(), 503);
    return errorResponse(e instanceof Error ? e.message : "Gagal update bibit", 500);
  }
}

// DELETE /api/perkebunan/bibit/[id] - hapus bibit (riwayat ikut terhapus)
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  try {
    const { id } = await params;
    const exists = await prisma.persediaanBarang.findUnique({ where: { id: id.toUpperCase() } });
    if (!exists || exists.kategori !== "Bibit/Benih") return errorResponse("Bibit tidak ditemukan", 404);
    await prisma.persediaanBarang.delete({ where: { id: exists.id } });
    return successResponse(null, "Bibit dihapus");
  } catch (e) {
    if (isDbConnectionError(e)) return errorResponse(dbUnreachableMessage(), 503);
    return errorResponse(e instanceof Error ? e.message : "Gagal hapus bibit", 500);
  }
}
