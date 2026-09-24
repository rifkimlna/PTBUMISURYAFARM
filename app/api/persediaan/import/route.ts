import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { kategoriPersediaanList } from "@/lib/validations/persediaanValidation";
import { generateKodeProduk } from "@/lib/persediaan";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";

const barisSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  kode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^BRG-\d{3,}$/, "Kode harus format BRG-001")
    .optional()
    .nullable(),
  kategori: z.string().trim().max(50).optional().nullable(),
  satuan: z.string().trim().max(20).optional().nullable(),
  stokAwal: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
  hargaBeli: z.coerce.number().nonnegative().max(10_000_000_000).optional().nullable(),
  hargaJual: z.coerce.number().nonnegative().max(10_000_000_000).optional().nullable(),
});

const bodySchema = z.object({
  rows: barisSchema.array().min(1, "Minimal 1 baris").max(500, "Maksimal 500 baris sekaligus"),
});

// POST /api/persediaan/import - tambah banyak produk sekaligus (dari CSV).
// Baris duplikat (kode sudah dipakai) dilewati dan dilaporkan, bukan gagal total.
export async function POST(req: NextRequest) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = bodySchema.parse(body);

    let dibuat = 0;
    const dilewati: Array<{ baris: number; alasan: string }> = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const r = parsed.rows[i];
      const noBaris = i + 1;
      try {
        const kode = r.kode ?? (await generateKodeProduk(prisma));
        const exists = await prisma.persediaanBarang.findUnique({
          where: { id: kode },
          select: { id: true },
        });
        if (exists) {
          dilewati.push({ baris: noBaris, alasan: `Kode ${kode} sudah dipakai` });
          continue;
        }
        const kategori =
          r.kategori && r.kategori.length > 0 ? r.kategori : kategoriPersediaanList[0];
        const hargaJual = r.hargaJual ?? null;
        const hargaBeli = r.hargaBeli ?? null;
        await prisma.persediaanBarang.create({
          data: {
            id: kode,
            namaBarang: r.nama,
            kategori,
            stokAwal: r.stokAwal ?? 0,
            satuan: r.satuan && r.satuan.length > 0 ? r.satuan : "pcs",
            hargaSatuan: hargaJual ?? hargaBeli ?? 0,
            tipeProduk: "BARANG",
            hargaBeli,
            hargaJual,
            batasMinimum: 0,
          },
        });
        dibuat += 1;
      } catch (e) {
        dilewati.push({ baris: noBaris, alasan: e instanceof Error ? e.message : "Gagal" });
      }
    }

    return successResponse(
      { dibuat, dilewati },
      `Import selesai: ${dibuat} produk dibuat${dilewati.length > 0 ? `, ${dilewati.length} baris dilewati` : ""}`,
      201
    );
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal import produk", 500);
  }
}
