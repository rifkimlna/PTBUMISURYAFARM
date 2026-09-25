import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { baseDokumenBeliSchema } from "@/lib/validations/pembelianValidation";
import { hitungJumlahBarisBeli } from "@/lib/pembelian-server";
import { deleteBuktiFile } from "@/lib/storage";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { z, ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

const editDokumenBeliSchema = baseDokumenBeliSchema
  .omit({ tipe: true, supplierId: true })
  .extend({ hapusLampiranIds: z.array(z.string().max(50)).max(20).default([]) });

// GET /api/pembelian/dokumen/[id] - detail untuk popup + form edit + halaman detail
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const dokumen = await prisma.dokumenPembelian.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { orderBy: { id: "asc" } },
      lampiran: { orderBy: { createdAt: "asc" } },
      pengiriman: {
        orderBy: { createdAt: "desc" },
        select: { id: true, noPengiriman: true, tanggalPengiriman: true, createdAt: true },
      },
    },
  });
  if (!dokumen) return errorResponse("Dokumen tidak ditemukan", 404);

  const [sumber, turunan] = await Promise.all([
    dokumen.referensiIds.length > 0
      ? prisma.dokumenPembelian.findMany({
          where: { id: { in: dokumen.referensiIds } },
          select: { id: true, tipe: true, noDokumen: true, tanggal: true, total: true, status: true },
        })
      : Promise.resolve([]),
    prisma.dokumenPembelian.findMany({
      where: { referensiIds: { has: dokumen.id } },
      select: { id: true, tipe: true, noDokumen: true, tanggal: true, total: true, status: true },
      orderBy: { tanggal: "desc" },
    }),
  ]);

  // Faktur yang merujuk dokumen ini (rantai ke utang).
  const fakturTerkait = await prisma.fakturPembelian.findMany({
    where: { referensiIds: { has: dokumen.id } },
    select: { id: true, noFaktur: true, tanggal: true, total: true },
    orderBy: { tanggal: "desc" },
  });

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
    sumber: sumber.map((s) => ({ ...s, total: Number(s.total) })),
    turunan: turunan.map((t) => ({ ...t, total: Number(t.total) })),
    faktur: fakturTerkait.map((f) => ({ ...f, total: Number(f.total) })),
  });
}

// PUT /api/pembelian/dokumen/[id] - ubah dokumen (tanpa efek keuangan)
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = editDokumenBeliSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const dokumen = await tx.dokumenPembelian.findUnique({ where: { id } });
      if (!dokumen) throw new Error("Dokumen tidak ditemukan");
      if (parsed.items.length === 0) throw new Error("Tambahkan minimal 1 baris produk");

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
      const newTotal = Math.round(items.reduce((s, it) => s + it.jumlah, 0) * 100) / 100;

      let hapusUrls: string[] = [];
      if (parsed.hapusLampiranIds.length > 0) {
        const hapus = await tx.dokumenPembelianLampiran.findMany({
          where: { id: { in: parsed.hapusLampiranIds }, dokumenId: id },
          select: { id: true, fileUrl: true },
        });
        hapusUrls = hapus.map((h) => h.fileUrl);
        await tx.dokumenPembelianLampiran.deleteMany({
          where: { id: { in: hapus.map((h) => h.id) } },
        });
      }

      const updated = await tx.dokumenPembelian.update({
        where: { id },
        data: {
          departemen: parsed.departemen?.trim() || null,
          email: parsed.email?.trim() || null,
          alamat: parsed.alamat?.trim() || null,
          tanggal: parsed.tanggal ?? dokumen.tanggal,
          jatuhTempo: parsed.jatuhTempo ?? null,
          noRefSupplier: parsed.noRefSupplier?.trim() || null,
          syaratPembayaran: parsed.syaratPembayaran?.trim() || null,
          gudang: parsed.gudang?.trim() || null,
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
        include: { _count: { select: { items: true, lampiran: true } } },
      });

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

// DELETE /api/pembelian/dokumen/[id] - hapus dokumen (tanpa efek keuangan)
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const dokumen = await prisma.dokumenPembelian.findUnique({
    where: { id },
    select: { id: true, tipe: true, referensiIds: true },
  });
  if (!dokumen) return errorResponse("Dokumen tidak ditemukan", 404);

  // Jangan hapus bila sudah ada turunan / faktur / pengiriman yang merujuknya.
  const [turunanCount, fakturCount, kirimCount] = await Promise.all([
    prisma.dokumenPembelian.count({ where: { referensiIds: { has: id } } }),
    prisma.fakturPembelian.count({ where: { referensiIds: { has: id } } }),
    dokumen.tipe === "PESANAN" ? prisma.pengirimanPembelian.count({ where: { pesananId: id } }) : Promise.resolve(0),
  ]);
  if (turunanCount > 0 || fakturCount > 0 || kirimCount > 0) {
    return errorResponse("Dokumen tidak bisa dihapus karena sudah ada turunan/faktur/pengiriman", 400);
  }

  const lampiran = await prisma.dokumenPembelianLampiran.findMany({
    where: { dokumenId: id },
    select: { fileUrl: true },
  });

  await prisma.dokumenPembelian.delete({ where: { id } });

  for (const l of lampiran) {
    await deleteBuktiFile(l.fileUrl);
  }

  // Kembalikan dokumen asal ke Belum Ditagih bila sudah yatim.
  if (dokumen.referensiIds.length > 0) {
    const asal = await prisma.dokumenPembelian.findMany({
      where: { id: { in: dokumen.referensiIds } },
      select: { id: true, tipe: true },
    });
    for (const a of asal) {
      const [masihDirujuk, fakturMerujuk, sisaKirim] = await Promise.all([
        prisma.dokumenPembelian.count({ where: { referensiIds: { has: a.id } } }),
        prisma.fakturPembelian.count({ where: { referensiIds: { has: a.id } } }),
        a.tipe === "PESANAN" ? prisma.pengirimanPembelian.count({ where: { pesananId: a.id } }) : Promise.resolve(1),
      ]);
      if (masihDirujuk === 0 && fakturMerujuk === 0 && sisaKirim === 0) {
        await prisma.dokumenPembelian.updateMany({
          where: { id: a.id },
          data: { status: "BELUM_DITAGIH" },
        });
      }
    }
  }

  return successResponse(null, "Dokumen berhasil dihapus");
}
