import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { baseFakturSchema } from "@/lib/validations/pembelianValidation";
import { deleteBuktiFile } from "@/lib/storage";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { z, ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

function hitungJumlah(kuantitas: number, harga: number, diskonPersen: number): number {
  return Math.round(kuantitas * harga * (1 - diskonPersen / 100) * 100) / 100;
}

// Edit memakai field yang sama dengan buat; nomor faktur & supplier dikunci.
// Total dikunci bila utang sudah ada pembayaran (aturan yang sama dengan penjualan).
const editFakturSchema = baseFakturSchema
  .omit({ supplierId: true })
  .extend({ hapusLampiranIds: z.array(z.string().max(50)).max(20).default([]) });

// GET /api/pembelian/faktur/[id] - detail + utang + pembayaran + COA per baris
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const faktur = await prisma.fakturPembelian.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { orderBy: { id: "asc" } },
      lampiran: { orderBy: { createdAt: "asc" } },
      tagihan: {
        select: {
          id: true,
          status: true,
          sisa: true,
          jumlah: true,
          noInvoice: true,
          pembayaran: {
            orderBy: { tanggal: "desc" },
            take: 20,
            select: {
              id: true,
              tanggal: true,
              sumberDana: true,
              jumlah: true,
              keterangan: true,
              kategori: true,
              kodeAkun: true,
            },
          },
        },
      },
    },
  });
  if (!faktur) return errorResponse("Faktur tidak ditemukan", 404);

  // Nama akun COA per baris dari database (format [kode] - [nama] di UI).
  const kodeList = [...new Set(faktur.items.map((it) => it.kodeAkun).filter(Boolean))] as string[];
  const akunDb =
    kodeList.length > 0
      ? await prisma.akunCOA.findMany({ where: { kode: { in: kodeList } }, select: { kode: true, nama: true } })
      : [];
  const namaAkun = (kode: string | null) => akunDb.find((a) => a.kode === kode)?.nama ?? null;

  const pembayaranCount = faktur.tagihanId
    ? await prisma.transaksiKas.count({ where: { tagihanId: faktur.tagihanId } })
    : 0;

  return successResponse({
    ...faktur,
    subtotal: Number(faktur.subtotal),
    total: Number(faktur.total),
    items: faktur.items.map((it) => ({
      ...it,
      kuantitas: Number(it.kuantitas),
      harga: Number(it.harga),
      diskonPersen: Number(it.diskonPersen),
      jumlah: Number(it.jumlah),
      namaAkun: namaAkun(it.kodeAkun),
    })),
    tagihan: faktur.tagihan
      ? {
          ...faktur.tagihan,
          sisa: Number(faktur.tagihan.sisa),
          jumlah: Number(faktur.tagihan.jumlah),
          pembayaran: faktur.tagihan.pembayaran.map((p) => ({ ...p, jumlah: Number(p.jumlah) })),
        }
      : null,
    pembayaranCount,
  });
}

// PUT /api/pembelian/faktur/[id] - ubah faktur (tanpa transaksi Kas baru)
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = editFakturSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const faktur = await tx.fakturPembelian.findUnique({ where: { id } });
      if (!faktur) throw new Error("Faktur tidak ditemukan");
      if (parsed.items.length === 0) throw new Error("Tambahkan minimal 1 baris produk");
      if (!parsed.jatuhTempo) throw new Error("Tanggal jatuh tempo wajib diisi");

      // Akun DEBIT tiap baris ditentukan otomatis (sama seperti saat buat):
      // produk master → persediaan (1105/1106/1107), selain itu → 5402.
      const items = [];
      for (const it of parsed.items) {
        let kodeAkun = it.kodeAkun?.trim() || null;
        if (kodeAkun) {
          const akun = await tx.akunCOA.findUnique({ where: { kode: kodeAkun } });
          if (!akun || !akun.isActive) throw new Error(`Akun COA ${kodeAkun} tidak ditemukan atau nonaktif`);
          const isPersediaan = ["1105", "1106", "1107"].includes(akun.kode);
          if (akun.kelompok !== "Beban" && !isPersediaan) {
            throw new Error(`Baris "${it.deskripsi}": akun harus persediaan (1105/1106/1107) atau Beban`);
          }
        } else if (it.produkId) {
          const barang = await tx.persediaanBarang.findUnique({
            where: { id: it.produkId },
            select: { id: true, kodeAkunCOA: true, kategori: true },
          });
          if (!barang) throw new Error(`Produk "${it.deskripsi}" tidak ditemukan di persediaan`);
          kodeAkun = barang.kodeAkunCOA ?? null;
          if (!kodeAkun) {
            const fallback: Record<string, string> = {
              "Pupuk & Obat-obatan": "1105",
              "Pakan Ternak/Ikan": "1106",
              "Bibit/Benih": "1107",
            };
            kodeAkun = fallback[barang.kategori] ?? "5402";
          }
          const akun = await tx.akunCOA.findUnique({ where: { kode: kodeAkun } });
          if (!akun || !akun.isActive) throw new Error(`Akun COA ${kodeAkun} tidak ditemukan atau nonaktif`);
        } else {
          kodeAkun = "5402";
          const akun = await tx.akunCOA.findUnique({ where: { kode: kodeAkun } });
          if (!akun || !akun.isActive) throw new Error(`Akun COA ${kodeAkun} tidak ditemukan atau nonaktif`);
        }
        items.push({
          produkId: it.produkId?.trim() || null,
          deskripsi: it.deskripsi.trim(),
          kuantitas: it.kuantitas,
          unit: it.unit.trim(),
          harga: it.harga,
          diskonPersen: it.diskonPersen ?? 0,
          kodeAkun,
          jumlah: hitungJumlah(it.kuantitas, it.harga, it.diskonPersen ?? 0),
        });
      }
      const newTotal = Math.round(items.reduce((s, it) => s + it.jumlah, 0) * 100) / 100;

      let tagihanSync: { jumlah: number; sisa: number } | null = null;
      if (faktur.tagihanId) {
        const bayarCount = await tx.transaksiKas.count({ where: { tagihanId: faktur.tagihanId } });
        if (bayarCount > 0) {
          if (newTotal !== Number(faktur.total)) {
            throw new Error("Total dikunci karena utang ini sudah ada pembayaran tercatat");
          }
        } else {
          tagihanSync = { jumlah: newTotal, sisa: newTotal };
        }
      }

      let hapusUrls: string[] = [];
      if (parsed.hapusLampiranIds.length > 0) {
        const hapus = await tx.fakturPembelianLampiran.findMany({
          where: { id: { in: parsed.hapusLampiranIds }, fakturId: id },
          select: { id: true, fileUrl: true },
        });
        hapusUrls = hapus.map((h) => h.fileUrl);
        await tx.fakturPembelianLampiran.deleteMany({ where: { id: { in: hapus.map((h) => h.id) } } });
      }

      const updated = await tx.fakturPembelian.update({
        where: { id },
        data: {
          email: parsed.email?.trim() || null,
          alamat: parsed.alamat?.trim() || null,
          tanggal: parsed.tanggal ?? faktur.tanggal,
          jatuhTempo: parsed.jatuhTempo ?? null,
          noRefSupplier: parsed.noRefSupplier?.trim() || null,
          syaratPembayaran: parsed.syaratPembayaran?.trim() || null,
          gudang: parsed.gudang?.trim() || null,
          tag: parsed.tag?.trim() || null,
          pesan: parsed.pesan?.trim() || null,
          memo: parsed.memo?.trim() || null,
          subtotal: newTotal,
          total: newTotal,
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

      if (faktur.tagihanId && tagihanSync) {
        await tx.tagihan.update({
          where: { id: faktur.tagihanId },
          data: { jumlah: tagihanSync.jumlah, sisa: tagihanSync.sisa },
        });
      }

      return { updated, hapusUrls };
    });

    for (const url of result.hapusUrls) {
      await deleteBuktiFile(url);
    }

    return successResponse(result.updated, "Faktur berhasil diubah");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal ubah faktur", 400);
  }
}

// DELETE /api/pembelian/faktur/[id] - hapus faktur + utang ikutannya (bila belum dibayar)
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const faktur = await prisma.fakturPembelian.findUnique({
    where: { id },
    select: { id: true, tagihanId: true, referensiIds: true },
  });
  if (!faktur) return errorResponse("Faktur tidak ditemukan", 404);

  const lampiran = await prisma.fakturPembelianLampiran.findMany({
    where: { fakturId: id },
    select: { fileUrl: true },
  });

  if (faktur.tagihanId) {
    const bayarCount = await prisma.transaksiKas.count({ where: { tagihanId: faktur.tagihanId } });
    if (bayarCount > 0) {
      return errorResponse("Faktur tidak bisa dihapus karena utangnya sudah ada pembayaran", 400);
    }
    await prisma.tagihan.delete({ where: { id: faktur.tagihanId } });
  }

  await prisma.fakturPembelian.delete({ where: { id } });

  for (const l of lampiran) {
    await deleteBuktiFile(l.fileUrl);
  }

  // Kembalikan dokumen asal ke Belum Ditagih bila sudah yatim.
  if (faktur.referensiIds.length > 0) {
    const asal = await prisma.dokumenPembelian.findMany({
      where: { id: { in: faktur.referensiIds } },
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

  return successResponse(null, "Faktur berhasil dihapus");
}
