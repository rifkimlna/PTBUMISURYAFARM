import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { createDokumenBeliSchema } from "@/lib/validations/pembelianValidation";
import { generateNoDokumenBeli, hitungJumlahBarisBeli } from "@/lib/pembelian-server";
import { hubungkanProdukItem } from "@/lib/produk-master";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

// POST /api/pembelian/dokumen - simpan dokumen pembelian tahap awal.
// PERMINTAAN/PENAWARAN/PESANAN: tanpa utang, tanpa Kas & Bank, tanpa COA.
// Status awal BELUM_DITAGIH (mengikuti Mekari). Dokumen asal yang dirujuk
// (permintaan->penawaran->pesanan) otomatis menjadi SELESAI.
// TUKAR_FAKTUR: hanya merujuk faktur (Tagihan HUTANG) yang belum lunas,
// tanpa utang/Kas baru, status awal TERBUKA.
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

      // Validasi faktur rujukan untuk Tukar Faktur: harus utang yang belum lunas.
      // Total tukar faktur = jumlah sisa utang yang dirujuk (bukan dari item kosong).
      let totalRujukan = 0;
      if (parsed.tipe === "TUKAR_FAKTUR") {
        const rujukan = await tx.tagihan.findMany({
          where: { id: { in: parsed.referensiIds } },
          select: { id: true, tipe: true, status: true, sisa: true },
        });
        if (rujukan.length !== parsed.referensiIds.length) {
          throw new Error("Sebagian faktur rujukan tidak ditemukan");
        }
        const invalid = rujukan.find((r) => r.tipe !== "HUTANG" || r.status === "LUNAS");
        if (invalid) throw new Error("Rujukan harus berupa utang yang belum lunas");
        totalRujukan = rujukan.reduce((s, r) => s + Number(r.sisa), 0);
      }

      const itemsInput = parsed.items.map((it) => ({
        produkId: it.produkId?.trim() || null,
        deskripsi: it.deskripsi.trim(),
        kuantitas: it.kuantitas,
        unit: it.unit.trim(),
        harga: it.harga,
        diskonPersen: it.diskonPersen ?? 0,
        kodeAkun: it.kodeAkun?.trim() || null,
        // Produk dari modul Pembelian ditandai sebagai PEMBELIAN (dari supplier)
        // agar muncul di halaman Produk tanpa duplikasi.
        sumberProduk: "PEMBELIAN" as const,
      }));
      // Hubungkan setiap baris ke master Produk: produk yang sudah terdaftar
      // dipakai ulang (tanpa duplikat); nama baru didaftarkan otomatis.
      const itemsTerhubung = await hubungkanProdukItem(tx, itemsInput);
      // Items terhubung urutannya selaras dengan itemsInput, jadi produkId diambil
      // sesuai indeks agar kolom item (kuantitas/diskon/kodeAkun) tetap utuh.
      const items = itemsInput.map((it, i) => ({
        produkId: itemsTerhubung[i]?.produkId ?? null,
        deskripsi: it.deskripsi,
        kuantitas: it.kuantitas,
        unit: it.unit,
        harga: it.harga,
        diskonPersen: it.diskonPersen,
        kodeAkun: it.kodeAkun,
        jumlah: hitungJumlahBarisBeli(it.kuantitas, it.harga, it.diskonPersen ?? 0),
      }));
      const subtotal =
        parsed.tipe === "TUKAR_FAKTUR"
          ? Math.round(totalRujukan * 100) / 100
          : Math.round(items.reduce((s, it) => s + it.jumlah, 0) * 100) / 100;

      const noDokumen = await generateNoDokumenBeli(parsed.tipe, tanggal);

      // Tandai dokumen asal selesai mengikuti rantai.
      // (Tukar Faktur merujuk Tagihan, bukan dokumen — tidak ada yang ditandai.)
      if (parsed.tipe !== "TUKAR_FAKTUR" && parsed.referensiIds.length > 0) {
        await tx.dokumenPembelian.updateMany({
          where: { id: { in: parsed.referensiIds }, status: { not: "SELESAI" } },
          data: { status: "SELESAI" },
        });
      }

      const dokumen = await tx.dokumenPembelian.create({
        data: {
          tipe: parsed.tipe,
          status: parsed.tipe === "TUKAR_FAKTUR" ? "TERBUKA" : "BELUM_DITAGIH",
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
