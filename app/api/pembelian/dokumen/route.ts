import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { createDokumenBeliSchema } from "@/lib/validations/pembelianValidation";
import { generateNoDokumenBeli, hitungJumlahBarisBeli } from "@/lib/pembelian-server";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

// POST /api/pembelian/dokumen - simpan dokumen pembelian tahap awal.
// PERMINTAAN/PENAWARAN/PESANAN: tanpa utang, tanpa Kas & Bank, tanpa COA.
// Status awal BELUM_DITAGIH (mengikuti Mekari). Dokumen asal yang dirujuk
// (permintaan->penawaran->pesanan) otomatis menjadi SELESAI.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  let adminId: string | null = (session as { userId?: string } | null)?.userId || null;
  if (!adminId) {
    const fallback = await prisma.user.findFirst({ select: { id: true } });
    adminId = fallback?.id || null;
  }
  if (!adminId) return errorResponse("Admin tidak ditemukan", 500);

  try {
    const body = await req.json();
    const parsed = createDokumenBeliSchema.parse(body);
    const tanggal = parsed.tanggal ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      if (parsed.supplierId) {
        const supplier = await tx.supplier.findUnique({ where: { id: parsed.supplierId } });
        if (!supplier) throw new Error("Supplier tidak ditemukan");
      }

      const items = parsed.items.map((it) => ({
        produkId: it.produkId?.trim() || null,
        deskripsi: it.deskripsi.trim(),
        kuantitas: it.kuantitas,
        unit: it.unit.trim(),
        harga: it.harga,
        diskonPersen: it.diskonPersen ?? 0,
        kodeAkun: it.kodeAkun?.trim() || null,
        jumlah: hitungJumlahBarisBeli(it.kuantitas, it.harga, it.diskonPersen ?? 0),
      }));
      const subtotal = Math.round(items.reduce((s, it) => s + it.jumlah, 0) * 100) / 100;

      const noDokumen = await generateNoDokumenBeli(parsed.tipe, tanggal);

      // Tandai dokumen asal selesai mengikuti rantai.
      if (parsed.referensiIds.length > 0) {
        await tx.dokumenPembelian.updateMany({
          where: { id: { in: parsed.referensiIds }, status: { not: "SELESAI" } },
          data: { status: "SELESAI" },
        });
      }

      const dokumen = await tx.dokumenPembelian.create({
        data: {
          tipe: parsed.tipe,
          status: "BELUM_DITAGIH",
          noDokumen,
          supplierId: parsed.supplierId || null,
          departemen: parsed.departemen?.trim() || null,
          email: parsed.email?.trim() || null,
          alamat: parsed.alamat?.trim() || null,
          tanggal,
          jatuhTempo: parsed.jatuhTempo ?? null,
          noRefSupplier: parsed.noRefSupplier?.trim() || null,
          syaratPembayaran: parsed.syaratPembayaran?.trim() || null,
          gudang: parsed.gudang?.trim() || null,
          pesan: parsed.pesan?.trim() || null,
          memo: parsed.memo?.trim() || null,
          subtotal,
          total: subtotal,
          referensiIds: parsed.referensiIds,
          adminId: adminId!,
          items: {
            create: items.map((it) => ({
              produkId: it.produkId,
              deskripsi: it.deskripsi,
              kuantitas: it.kuantitas,
              unit: it.unit,
              harga: it.harga,
              diskonPersen: it.diskonPersen,
              kodeAkun: it.kodeAkun,
              jumlah: it.jumlah,
            })),
          },
          ...(parsed.lampiran && parsed.lampiran.length > 0
            ? {
                lampiran: {
                  create: parsed.lampiran.map((l) => ({
                    fileName: l.fileName,
                    fileUrl: l.fileUrl,
                    fileType: l.fileType ?? "application/octet-stream",
                    fileSize: l.fileSize ?? 0,
                  })),
                },
              }
            : {}),
        },
        include: {
          supplier: { select: { id: true, nama: true } },
          _count: { select: { items: true, lampiran: true } },
        },
      });

      return dokumen;
    });

    return successResponse(result, "Dokumen pembelian berhasil disimpan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal simpan dokumen", 500);
  }
}
