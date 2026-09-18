import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { createDokumenSchema } from "@/lib/validations/penjualanValidation";
import { AKUN_PENDAPATAN_BY_JENIS, generateNoDokumen, hitungJumlahBaris } from "@/lib/penjualan-server";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

// POST /api/penjualan/dokumen - simpan dokumen penjualan (tanpa login demo).
// - PENAGIHAN: sekaligus membuat Tagihan PIUTANG (1 piutang per penagihan, tanpa transaksi Kas).
// - TUKAR_FAKTUR: hanya merujuk faktur yang sudah ada (tanpa piutang/Kas baru).
// - PENAWARAN/PESANAN/PROFORMA: hanya dokumen, tanpa piutang dan tanpa Kas & Bank.
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
    const parsed = createDokumenSchema.parse(body);
    const tanggal = parsed.tanggal ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      const pelanggan = await tx.pelanggan.findUnique({ where: { id: parsed.pelangganId } });
      if (!pelanggan) throw new Error("Pelanggan tidak ditemukan");

      // Validasi faktur rujukan untuk Tukar Faktur: harus piutang yang belum lunas.
      if (parsed.tipe === "TUKAR_FAKTUR") {
        const rujukan = await tx.tagihan.findMany({
          where: { id: { in: parsed.referensiIds } },
          select: { id: true, tipe: true, status: true },
        });
        if (rujukan.length !== parsed.referensiIds.length) {
          throw new Error("Sebagian faktur rujukan tidak ditemukan");
        }
        const invalid = rujukan.find((r) => r.tipe !== "PIUTANG" || r.status === "LUNAS");
        if (invalid) throw new Error("Rujukan harus berupa piutang yang belum lunas");
      }

      // Hitung ulang total di server dari baris item (otoritatif, bukan dari client).
      const items = parsed.items.map((it) => ({
        produkId: it.produkId?.trim() || null,
        deskripsi: it.deskripsi.trim(),
        kuantitas: it.kuantitas,
        unit: it.unit.trim(),
        harga: it.harga,
        diskonPersen: it.diskonPersen ?? 0,
        jumlah: hitungJumlahBaris(it.kuantitas, it.harga, it.diskonPersen ?? 0),
      }));
      const subtotal = Math.round(items.reduce((s, it) => s + it.jumlah, 0) * 100) / 100;

      const noDokumen = await generateNoDokumen(parsed.tipe, tanggal);

      // Hanya PENAGIHAN yang menghasilkan piutang. Tanpa transaksi Kas & Bank
      // (pelanggan belum membayar; Kas tercatat saat pembayaran via Hutang & Piutang).
      // COA otomatis: jenis penjualan → akun pendapatan (4101/4102/4103/4104),
      // tersimpan di Tagihan.jenis (debit 1102 - Piutang, kredit akun pendapatan).
      let tagihanId: string | null = null;
      if (parsed.tipe === "PENAGIHAN") {
        const jenis = parsed.jenis ?? "LAINNYA";
        const kodePendapatan = AKUN_PENDAPATAN_BY_JENIS[jenis];
        const akunPendapatan = await tx.akunCOA.findUnique({ where: { kode: kodePendapatan } });
        if (!akunPendapatan || !akunPendapatan.isActive) {
          throw new Error(`Akun COA ${kodePendapatan} tidak ditemukan atau nonaktif`);
        }
        const tagihan = await tx.tagihan.create({
          data: {
            tipe: "PIUTANG",
            pihak: pelanggan.nama,
            keterangan:
              parsed.memo?.trim() ||
              parsed.pesan?.trim() ||
              `Penagihan ${noDokumen}`,
            jumlah: subtotal,
            sisa: subtotal,
            tanggal,
            jatuhTempo: parsed.jatuhTempo ?? null,
            dokumen: "PENAGIHAN",
            noInvoice: noDokumen,
            jenis,
            adminId: adminId!,
          },
          select: { id: true },
        });
        tagihanId = tagihan.id;
      }

      const dokumen = await tx.dokumenPenjualan.create({
        data: {
          tipe: parsed.tipe,
          noDokumen,
          pelangganId: pelanggan.id,
          email: parsed.email?.trim() || null,
          alamat: parsed.alamat?.trim() || null,
          tanggal,
          jatuhTempo: parsed.jatuhTempo ?? null,
          noRefPelanggan: parsed.noRefPelanggan?.trim() || null,
          syaratPembayaran: parsed.syaratPembayaran?.trim() || null,
          pesan: parsed.pesan?.trim() || null,
          memo: parsed.memo?.trim() || null,
          subtotal,
          total: subtotal,
          referensiIds: parsed.referensiIds,
          ...(tagihanId ? { tagihanId } : {}),
          adminId: adminId!,
          items: {
            create: items.map((it) => ({
              produkId: it.produkId,
              deskripsi: it.deskripsi,
              kuantitas: it.kuantitas,
              unit: it.unit,
              harga: it.harga,
              diskonPersen: it.diskonPersen,
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
          pelanggan: { select: { id: true, nama: true } },
          _count: { select: { items: true, lampiran: true } },
        },
      });

      return dokumen;
    });

    return successResponse(result, "Dokumen penjualan berhasil disimpan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal simpan dokumen", 500);
  }
}
