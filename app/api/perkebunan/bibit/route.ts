import { NextRequest } from "next/server";
import { prisma, isDbConnectionError, dbUnreachableMessage } from "@/lib/prisma";
import { requireAuthAndRole, type Role } from "@/lib/auth";
import { createPersediaanBarangSchema } from "@/lib/validations/persediaanValidation";
import { hitungStokSaatIni, tentukanStatusStok, generateKodeProduk } from "@/lib/persediaan";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN_PERTANIAN"];
const KATEGORI_BIBIT = "Bibit/Benih" as const;

// GET /api/perkebunan/bibit - daftar bibit + stok (dikelola admin perkebunan)
export async function GET(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  try {
    const [barang, agg] = await Promise.all([
      prisma.persediaanBarang.findMany({
        where: { kategori: KATEGORI_BIBIT },
        orderBy: { createdAt: "desc" },
      }),
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
      return {
        id: b.id,
        namaBarang: b.namaBarang,
        satuan: b.satuan,
        stok,
        hargaSatuan: Number(b.hargaSatuan),
        hargaJual: b.hargaJual == null ? null : Number(b.hargaJual),
        fotoUrl: b.fotoUrl,
        keterangan: b.keterangan,
        batasMinimum: b.batasMinimum,
        status: tentukanStatusStok(stok),
        createdAt: b.createdAt.toISOString(),
      };
    });

    return successResponse({ data, total: data.length });
  } catch (e) {
    if (isDbConnectionError(e)) return errorResponse(dbUnreachableMessage(), 503);
    return errorResponse(e instanceof Error ? e.message : "Gagal muat bibit", 500);
  }
}

// POST /api/perkebunan/bibit - tambah bibit baru (kategori dikunci Bibit/Benih)
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ROLES);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = createPersediaanBarangSchema.parse({ ...body, kategori: KATEGORI_BIBIT });
    const kode = parsed.kode?.toUpperCase() ?? (await generateKodeProduk(prisma));
    const exists = await prisma.persediaanBarang.findUnique({ where: { id: kode } });
    if (exists) return errorResponse(`Kode barang ${kode} sudah dipakai`, 409);

    const hargaSatuan = parsed.hargaSatuan ?? parsed.hargaJual ?? parsed.hargaBeli ?? 0;

    const barang = await prisma.persediaanBarang.create({
      data: {
        id: kode,
        namaBarang: parsed.namaBarang,
        kategori: KATEGORI_BIBIT,
        stokAwal: parsed.stokAwal,
        satuan: parsed.satuan,
        hargaSatuan,
        keterangan: parsed.keterangan ?? null,
        fotoUrl: parsed.fotoUrl ?? null,
        tipeProduk: "BARANG",
        hargaBeli: parsed.hargaBeli ?? null,
        hargaJual: parsed.hargaJual ?? null,
        batasMinimum: parsed.batasMinimum ?? 0,
      },
    });
    return successResponse(barang, "Bibit ditambahkan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    if (isDbConnectionError(e)) return errorResponse(dbUnreachableMessage(), 503);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah bibit", 500);
  }
}
