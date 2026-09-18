import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { createPembelianSchema } from "@/lib/validations/persediaanValidation";
import { getKodeAkunPersediaan, getKodeAkunSumberDana, validateKategoriHasCOAMapping } from "@/lib/persediaan-coa-mapping";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = createPembelianSchema.parse(body);

    // Validasi barang exists
    const barang = await prisma.persediaanBarang.findUnique({
      where: { id },
      select: { id: true, namaBarang: true, kategori: true, hargaSatuan: true, satuan: true, kodeAkunCOA: true },
    });
    if (!barang) return errorResponse("Barang tidak ditemukan", 404);

    // Validasi barangId matches
    if (parsed.barangId !== id) {
      return errorResponse("ID barang tidak cocok", 400);
    }

    // Validasi kategori memiliki mapping COA
    const validation = validateKategoriHasCOAMapping(barang.kategori);
    if (!validation.valid) {
      return errorResponse(validation.error || "Kategori tidak memiliki mapping COA", 400);
    }

    // Ambil kode akun COA - gunakan dari barang jika ada, fallback ke mapping
    const kategoriPersediaan = barang.kategori as "Bibit/Benih" | "Pupuk & Obat-obatan" | "Pakan Ternak/Ikan";
    const kodeAkunPersediaan = barang.kodeAkunCOA ?? getKodeAkunPersediaan(kategoriPersediaan);
    if (!kodeAkunPersediaan) {
      return errorResponse(`Tidak dapat menentukan kode akun COA untuk kategori "${barang.kategori}"`, 400);
    }

    // Ambil kode akun sumber dana
    const kodeAkunSumberDana = getKodeAkunSumberDana(kategoriPersediaan, parsed.sumberDana);
    if (!kodeAkunSumberDana) {
      return errorResponse(`Tidak dapat menentukan kode akun sumber dana untuk ${parsed.sumberDana}`, 400);
    }

    // Validasi akun COA exists di database
    const [akunPersediaan, akunSumberDana] = await Promise.all([
      prisma.akunCOA.findUnique({ where: { kode: kodeAkunPersediaan } }),
      prisma.akunCOA.findUnique({ where: { kode: kodeAkunSumberDana } }),
    ]);

    if (!akunPersediaan) {
      return errorResponse(`Akun COA persediaan ${kodeAkunPersediaan} tidak ditemukan`, 400);
    }
    if (!akunSumberDana) {
      return errorResponse(`Akun COA sumber dana ${kodeAkunSumberDana} tidak ditemukan`, 400);
    }

    // Hitung total
    const total = Number(parsed.hargaSatuan) * parsed.jumlah;

    // Get admin ID
    const session = await getSessionFromRequest(req);
    let adminId: string | null = session?.userId ?? null;
    if (!adminId) {
      const fallback = await prisma.user.findFirst({ select: { id: true } });
      adminId = fallback?.id ?? null;
    }
    if (!adminId) return errorResponse("Admin tidak ditemukan", 500);

    // Execute in transaction untuk konsistensi data
    const result = await prisma.$transaction(async (tx) => {
      // 1. Catat stok masuk
      const riwayatStok = await tx.riwayatStok.create({
        data: {
          barangId: id,
          jenis: "MASUK",
          jumlah: parsed.jumlah,
          keterangan: parsed.keterangan ? `Pembelian: ${parsed.keterangan}` : "Pembelian barang",
          tanggal: parsed.tanggal ?? new Date(),
        },
      });

      // 2. Buat transaksi kas (pengeluaran)
      const transaksiKas = await tx.transaksiKas.create({
        data: {
          tipe: "PENGELUARAN",
          kategori: akunPersediaan.nama, // Nama akun COA sebagai kategori
          kodeAkun: kodeAkunPersediaan,
          sumberDana: parsed.sumberDana,
          jumlah: total,
          keterangan: parsed.keterangan ? `Pembelian ${barang.namaBarang} ${parsed.jumlah} ${barang.satuan} @ Rp ${Number(parsed.hargaSatuan).toLocaleString("id-ID")}. ${parsed.keterangan}` : `Pembelian ${barang.namaBarang} ${parsed.jumlah} ${barang.satuan} @ Rp ${Number(parsed.hargaSatuan).toLocaleString("id-ID")}`,
          tanggal: parsed.tanggal ?? new Date(),
          adminId: adminId!,
        },
        include: { admin: { select: { id: true, nama: true } }, _count: { select: { bukti: true } } },
      });

      // 3. Simpan bukti jika ada
      if (parsed.bukti && parsed.bukti.length > 0) {
        await tx.buktiTransaksi.createMany({
          data: parsed.bukti.map((b) => ({
            transaksiId: transaksiKas.id,
            fileName: b.fileName,
            fileUrl: b.fileUrl,
            fileType: b.fileType ?? "application/octet-stream",
            fileSize: b.fileSize ?? 0,
          })),
        });
      }

      return { riwayatStok, transaksiKas };
    }, {
      timeout: 10000, // 10 detik timeout
    });

    return successResponse({
      riwayatStok: result.riwayatStok,
      transaksiKas: {
        ...result.transaksiKas,
        jumlah: Number(result.transaksiKas.jumlah),
      },
    }, "Pembelian berhasil dicatat: stok bertambah, transaksi keuangan tercatat, COA terhubung", 201);

  } catch (e: unknown) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2003") {
      return errorResponse("Referensi data tidak valid (foreign key constraint)", 400);
    }
    console.error("Pembelian error:", e);
    return errorResponse(e instanceof Error ? e.message : "Gagal mencatat pembelian", 500);
  }
}