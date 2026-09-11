import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { createPersediaanBarangSchema } from "@/lib/validations/persediaanValidation";
import { hitungStokSaatIni, tentukanStatusStok } from "@/lib/persediaan";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const [barang, agg] = await Promise.all([
    prisma.persediaanBarang.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.riwayatStok.groupBy({ by: ["barangId", "jenis"], _sum: { jumlah: true } }),
  ]);

  const map = new Map<string, { MASUK: number; KELUAR: number }>();
  for (const a of agg) {
    const entry = map.get(a.barangId) ?? { MASUK: 0, KELUAR: 0 };
    entry[a.jenis] += a._sum.jumlah ?? 0;
    map.set(a.barangId, entry);
  }

  const data = barang.map((b) => {
    const sums = map.get(b.id) ?? { MASUK: 0, KELUAR: 0 };
    const stok = hitungStokSaatIni(b.stokAwal, [
      { jenis: "MASUK", jumlah: sums.MASUK },
      { jenis: "KELUAR", jumlah: sums.KELUAR },
    ]);
    const hargaSatuan = Number(b.hargaSatuan);
    return {
      id: b.id,
      namaBarang: b.namaBarang,
      kategori: b.kategori,
      stokAwal: b.stokAwal,
      stok,
      satuan: b.satuan,
      hargaSatuan,
      totalNilai: stok * hargaSatuan,
      keterangan: b.keterangan,
      status: tentukanStatusStok(stok),
      createdAt: b.createdAt.toISOString(),
    };
  });

  const summary = {
    totalJenis: data.length,
    totalStok: data.reduce((sum, d) => sum + d.stok, 0),
    nilaiPersediaan: data.reduce((sum, d) => sum + d.totalNilai, 0),
  };

  return successResponse({ data, summary });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = createPersediaanBarangSchema.parse(body);
    const exists = await prisma.persediaanBarang.findUnique({ where: { id: parsed.kode } });
    if (exists) return errorResponse(`Kode barang ${parsed.kode} sudah dipakai`, 409);

    const barang = await prisma.persediaanBarang.create({
      data: {
        id: parsed.kode,
        namaBarang: parsed.namaBarang,
        kategori: parsed.kategori,
        stokAwal: parsed.stokAwal,
        satuan: parsed.satuan,
        hargaSatuan: parsed.hargaSatuan,
        keterangan: parsed.keterangan ?? null,
      },
    });
    return successResponse(barang, "Barang ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah barang", 500);
  }
}