import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { baseDokumenSchema } from "@/lib/validations/penjualanValidation";
import { hitungJumlahBaris } from "@/lib/penjualan-server";
import { deleteBuktiFile } from "@/lib/storage";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { z, ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

// Edit memakai field yang sama dengan buat; nomor dokumen & pelanggan tidak bisa diganti.
// Aturan min-items / referensi / tempo wajib dicek manual di handler (lihat bawah).
const editDokumenSchema = baseDokumenSchema
  .omit({ tipe: true, pelangganId: true })
  .extend({ hapusLampiranIds: z.array(z.string().max(50)).max(20).default([]) });

// GET /api/penjualan/dokumen/[id] - detail untuk form edit + halaman detail
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const dokumen = await prisma.dokumenPenjualan.findUnique({
    where: { id },
    include: {
      pelanggan: true,
      items: { orderBy: { id: "asc" } },
      lampiran: { orderBy: { createdAt: "asc" } },
      tagihan: { select: { id: true, status: true, sisa: true, noInvoice: true, jenis: true } },
      pengiriman: {
        orderBy: { createdAt: "desc" },
        select: { id: true, noPengiriman: true, tanggalPengiriman: true, createdAt: true },
      },
    },
  });
  if (!dokumen) return errorResponse("Dokumen tidak ditemukan", 404);

  const pembayaranCount = dokumen.tagihanId
    ? await prisma.transaksiKas.count({ where: { tagihanId: dokumen.tagihanId } })
    : 0;

  // Telusur relasi: dokumen sumber (referensiIds menunjuk id dokumen lain)
  // dan dokumen turunan (dokumen lain yang referensiIds-nya memuat id ini).
  const [sumber, turunan] = await Promise.all([
    dokumen.referensiIds.length > 0
      ? prisma.dokumenPenjualan.findMany({
          where: { id: { in: dokumen.referensiIds } },
          select: { id: true, tipe: true, noDokumen: true, tanggal: true, total: true, status: true },
        })
      : Promise.resolve([]),
    prisma.dokumenPenjualan.findMany({
      where: { referensiIds: { has: dokumen.id } },
      select: { id: true, tipe: true, noDokumen: true, tanggal: true, total: true, status: true },
      orderBy: { tanggal: "desc" },
    }),
  ]);

  return successResponse({
    ...dokumen,
    subtotal: Number(dokumen.subtotal),
    total: Number(dokumen.total),
    items: dokumen.items.map((it) => ({
      ...it,
      kuantitas: Number(it.kuantitas),
      harga: Number(it.harga),
      diskonPersen: Number(it.diskonPersen),
      jumlah: Number(it.jumlah),
    })),
    pembayaranCount,
    sumber: sumber.map((s) => ({ ...s, total: Number(s.total) })),
    turunan: turunan.map((t) => ({ ...t, total: Number(t.total) })),
  });
}

// PUT /api/penjualan/dokumen/[id] - ubah dokumen dengan form yang sama seperti input awal.
// Aturan sync piutang (tipe PENAGIHAN): total hanya boleh berubah bila linked tagihan
// belum ada pembayaran; bila sudah ada pembayaran, total dikunci (400 bila dipaksa).
// Tidak pernah membuat transaksi Kas & Bank.
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = editDokumenSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const dokumen = await tx.dokumenPenjualan.findUnique({ where: { id } });
      if (!dokumen) throw new Error("Dokumen tidak ditemukan");

      if (dokumen.tipe === "TUKAR_FAKTUR") {
        if (parsed.referensiIds.length === 0) throw new Error("Pilih minimal 1 faktur/penagihan");
        const rujukan = await tx.tagihan.findMany({
          where: { id: { in: parsed.referensiIds } },
          select: { id: true, tipe: true, status: true },
        });
        if (rujukan.length !== parsed.referensiIds.length) throw new Error("Sebagian faktur rujukan tidak ditemukan");
        if (rujukan.some((r) => r.tipe !== "PIUTANG" || r.status === "LUNAS")) {
          throw new Error("Rujukan harus berupa piutang yang belum lunas");
        }
      } else if (parsed.items.length === 0) {
        throw new Error("Tambahkan minimal 1 baris produk");
      }
      if (dokumen.tipe === "PENAGIHAN" && !parsed.jatuhTempo) {
        throw new Error("Tanggal jatuh tempo wajib diisi");
      }

      const items = parsed.items.map((it) => ({
        produkId: it.produkId?.trim() || null,
        deskripsi: it.deskripsi.trim(),
        kuantitas: it.kuantitas,
        unit: it.unit.trim(),
        harga: it.harga,
        diskonPersen: it.diskonPersen ?? 0,
        jumlah: hitungJumlahBaris(it.kuantitas, it.harga, it.diskonPersen ?? 0),
      }));
      const newTotal = Math.round(items.reduce((s, it) => s + it.jumlah, 0) * 100) / 100;

      // Kunci total bila piutang tertaut sudah dibayar sebagian/lunas.
      let tagihanSync: { jumlah: number; sisa: number } | null = null;
      if (dokumen.tagihanId) {
        const bayarCount = await tx.transaksiKas.count({ where: { tagihanId: dokumen.tagihanId } });
        if (bayarCount > 0) {
          if (newTotal !== Number(dokumen.total)) {
            throw new Error("Total dikunci karena piutang ini sudah ada pembayaran tercatat");
          }
        } else {
          tagihanSync = { jumlah: newTotal, sisa: newTotal };
        }
      }

      // Hapus lampiran yang diminta (baris DB + file fisik best-effort).
      let hapusUrls: string[] = [];
      if (parsed.hapusLampiranIds.length > 0) {
        const hapus = await tx.dokumenLampiran.findMany({
          where: { id: { in: parsed.hapusLampiranIds }, dokumenId: id },
          select: { id: true, fileUrl: true },
        });
        hapusUrls = hapus.map((h) => h.fileUrl);
        await tx.dokumenLampiran.deleteMany({
          where: { id: { in: hapus.map((h) => h.id) } },
        });
      }

      const updated = await tx.dokumenPenjualan.update({
        where: { id },
        data: {
          email: parsed.email?.trim() || null,
          alamat: parsed.alamat?.trim() || null,
          tanggal: parsed.tanggal ?? dokumen.tanggal,
          jatuhTempo: parsed.jatuhTempo ?? null,
          noRefPelanggan: parsed.noRefPelanggan?.trim() || null,
          syaratPembayaran: parsed.syaratPembayaran?.trim() || null,
          pesan: parsed.pesan?.trim() || null,
          memo: parsed.memo?.trim() || null,
          subtotal: newTotal,
          total: newTotal,
          referensiIds: parsed.referensiIds,
          items: {
            deleteMany: {},
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
        include: { _count: { select: { items: true, lampiran: true } } },
      });

      if (dokumen.tagihanId && tagihanSync) {
        await tx.tagihan.update({
          where: { id: dokumen.tagihanId },
          data: { jumlah: tagihanSync.jumlah, sisa: tagihanSync.sisa },
        });
      }

      // Jenis penjualan (metadata akun pendapatan otomatis) boleh dikoreksi
      // kapan saja — tidak memengaruhi jumlah/sisa maupun Kas & Bank.
      if (dokumen.tagihanId && parsed.jenis) {
        await tx.tagihan.update({
          where: { id: dokumen.tagihanId },
          data: { jenis: parsed.jenis },
        });
      }

      return { updated, hapusUrls };
    });

    for (const url of result.hapusUrls) {
      await deleteBuktiFile(url);
    }

    return successResponse(result.updated, "Dokumen berhasil diubah");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ubah dokumen", 400);
  }
}

// DELETE /api/penjualan/dokumen/[id] - hapus dokumen + piutang ikutannya (bila belum dibayar).
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const dokumen = await prisma.dokumenPenjualan.findUnique({
    where: { id },
    select: { id: true, tipe: true, tagihanId: true, referensiIds: true },
  });
  if (!dokumen) return errorResponse("Dokumen tidak ditemukan", 404);

  const lampiran = await prisma.dokumenLampiran.findMany({
    where: { dokumenId: id },
    select: { fileUrl: true },
  });

  if (dokumen.tagihanId) {
    const bayarCount = await prisma.transaksiKas.count({ where: { tagihanId: dokumen.tagihanId } });
    if (bayarCount > 0) {
      return errorResponse("Dokumen tidak bisa dihapus karena piutangnya sudah ada pembayaran", 400);
    }
    await prisma.tagihan.delete({ where: { id: dokumen.tagihanId } });
  }

  await prisma.dokumenPenjualan.delete({ where: { id } });

  for (const l of lampiran) {
    await deleteBuktiFile(l.fileUrl);
  }

  // Kembalikan dokumen asal ke Belum Ditagih bila sudah tidak dirujuk dokumen lain
  // dan (untuk pesanan) sudah tidak ada pengirimannya.
  if (dokumen.referensiIds.length > 0) {
    const asal = await prisma.dokumenPenjualan.findMany({
      where: { id: { in: dokumen.referensiIds }, tipe: { in: ["PESANAN", "PENAWARAN"] } },
      select: { id: true, tipe: true },
    });
    for (const a of asal) {
      const [masihDirujuk, sisaKirim] = await Promise.all([
        prisma.dokumenPenjualan.count({ where: { referensiIds: { has: a.id } } }),
        a.tipe === "PESANAN"
          ? prisma.pengirimanPenjualan.count({ where: { pesananId: a.id } })
          : Promise.resolve(1),
      ]);
      if (masihDirujuk === 0 && sisaKirim === 0) {
        await prisma.dokumenPenjualan.updateMany({
          where: { id: a.id },
          data: { status: "BELUM_DITAGIH" },
        });
      }
    }
  }

  return successResponse(null, "Dokumen berhasil dihapus");
}
