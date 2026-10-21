import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole } from "@/lib/auth";
import { baseDokumenSchema } from "@/lib/validations/penjualanValidation";
import { hitungJumlahBaris } from "@/lib/penjualan-server";
import { hubungkanProdukItem } from "@/lib/produk-master";
import { deleteBuktiFile } from "@/lib/storage";
import { hapusDokumenPenjualanSumber } from "@/lib/hapus-rantai";
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

  // Tukar Faktur merujuk Tagihan PIUTANG (bukan dokumen) — sertakan rinciannya
  // sekaligus hitung ulang total dari sisa rujukan (dokumen lama bisa tersimpan 0).
  const rujukanPiutang =
    dokumen.tipe === "TUKAR_FAKTUR" && dokumen.referensiIds.length > 0
      ? await prisma.tagihan.findMany({
          where: { id: { in: dokumen.referensiIds } },
          select: { id: true, pihak: true, jumlah: true, sisa: true, status: true, jatuhTempo: true, noInvoice: true },
          orderBy: { jatuhTempo: "asc" },
        })
      : [];
  const totalRujukan = rujukanPiutang.reduce((s, r) => s + Number(r.sisa), 0);

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
    subtotal: dokumen.tipe === "TUKAR_FAKTUR" ? Math.round(totalRujukan * 100) / 100 : Number(dokumen.subtotal),
    total: dokumen.tipe === "TUKAR_FAKTUR" ? Math.round(totalRujukan * 100) / 100 : Number(dokumen.total),
    rujukanPiutang: rujukanPiutang.map((r) => ({ ...r, jumlah: Number(r.jumlah), sisa: Number(r.sisa) })),
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

      // Ambil item lama untuk membalikan stok saat edit penjualan (PENAGIHAN),
      // agar edit tidak menyebabkan perubahan stok ganda.
      const oldItems =
        dokumen.tipe === "PENAGIHAN"
          ? await tx.dokumenPenjualanItem.findMany({
              where: { dokumenId: id },
              select: { produkId: true, kuantitas: true },
            })
          : [];

      let totalRujukan = 0;
      if (dokumen.tipe === "TUKAR_FAKTUR") {
        if (!parsed.syaratPembayaran?.trim()) throw new Error("Syarat pembayaran wajib dipilih");
        if (parsed.referensiIds.length === 0) throw new Error("Pilih minimal 1 faktur/penagihan");
        const rujukan = await tx.tagihan.findMany({
          where: { id: { in: parsed.referensiIds } },
          select: { id: true, tipe: true, status: true, sisa: true },
        });
        if (rujukan.length !== parsed.referensiIds.length) throw new Error("Sebagian faktur rujukan tidak ditemukan");
        if (rujukan.some((r) => r.tipe !== "PIUTANG" || r.status === "LUNAS")) {
          throw new Error("Rujukan harus berupa piutang yang belum lunas");
        }
        totalRujukan = rujukan.reduce((s, r) => s + Number(r.sisa), 0);
      } else if (parsed.items.length === 0) {
        throw new Error("Tambahkan minimal 1 baris produk");
      }
      if (dokumen.tipe === "PENAGIHAN" && !parsed.jatuhTempo) {
        throw new Error("Tanggal jatuh tempo wajib diisi");
      }

      // Hubungkan baris ke master Produk (pakai ulang bila sudah ada, daftarkan
      // bila baru) — sumber data sama dengan halaman Produk, tanpa duplikat.
      const itemsTerhubung = await hubungkanProdukItem(tx, parsed.items);

      const items = itemsTerhubung.map((it) => ({
        produkId: it.produkId,
        deskripsi: it.deskripsi.trim(),
        kuantitas: it.kuantitas,
        unit: it.unit.trim(),
        harga: it.harga,
        diskonPersen: it.diskonPersen ?? 0,
        jumlah: hitungJumlahBaris(it.kuantitas, it.harga, it.diskonPersen ?? 0),
      }));
      const newTotal =
        dokumen.tipe === "TUKAR_FAKTUR"
          ? Math.round(totalRujukan * 100) / 100
          : Math.round(items.reduce((s, it) => s + it.jumlah, 0) * 100) / 100;

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

      // Edit penjualan (PENAGIHAN): balikan stok lama lalu terapkan stok baru,
      // dengan validasi agar tidak ada perubahan ganda dan stok tidak negatif.
      if (dokumen.tipe === "PENAGIHAN") {
        for (const it of oldItems) {
          if (it.produkId && Number(it.kuantitas) > 0) {
            await tx.riwayatStok.create({
              data: {
                barangId: it.produkId,
                jenis: "MASUK",
                jumlah: Number(it.kuantitas),
                keterangan: `Reversal: edit penjualan ${dokumen.noDokumen}`,
                sumber: "PENJUALAN",
                tanggal: parsed.tanggal ?? dokumen.tanggal,
              },
            });
          }
        }
        const newItems = items.filter((it) => it.produkId && it.kuantitas > 0);
        if (newItems.length > 0) {
          const produkIds = [...new Set(newItems.map((it) => it.produkId!).filter(Boolean))];
          const barangData = await tx.persediaanBarang.findMany({
            where: { id: { in: produkIds } },
            select: { id: true, namaBarang: true, stokAwal: true },
          });
          const stokAwalMap = new Map(barangData.map((b) => [b.id, b.stokAwal]));
          const namaMap = new Map(barangData.map((b) => [b.id, b.namaBarang]));
          const riwayatAgg = await tx.riwayatStok.groupBy({
            by: ["barangId", "jenis"],
            where: { barangId: { in: produkIds } },
            _sum: { jumlah: true },
          });
          const stokMap = new Map<string, number>();
          for (const pid of produkIds) {
            let stok = stokAwalMap.get(pid) ?? 0;
            for (const a of riwayatAgg) {
              if (a.barangId === pid) {
                stok += a.jenis === "MASUK" ? (a._sum.jumlah ?? 0) : -(a._sum.jumlah ?? 0);
              }
            }
            stokMap.set(pid, stok);
          }
          const qtyMap = new Map<string, number>();
          for (const it of newItems) {
            qtyMap.set(it.produkId!, (qtyMap.get(it.produkId!) ?? 0) + it.kuantitas);
          }
          for (const [pid, qty] of qtyMap) {
            const stok = stokMap.get(pid) ?? 0;
            if (stok < qty) {
              throw new Error(
                `Stok tidak cukup untuk "${namaMap.get(pid) ?? pid}": tersedia ${stok}, dijual ${qty}.`
              );
            }
          }
          for (const it of newItems) {
            await tx.riwayatStok.create({
              data: {
                barangId: it.produkId!,
                jenis: "KELUAR",
                jumlah: it.kuantitas,
                keterangan: `Jual via ${dokumen.noDokumen}`,
                sumber: "PENJUALAN",
                tanggal: parsed.tanggal ?? dokumen.tanggal,
              },
            });
          }
        }
      }

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

  try {
    const hasil = await prisma.$transaction((tx) => hapusDokumenPenjualanSumber(tx, id));

    for (const url of hasil.hapusUrls) {
      await deleteBuktiFile(url);
    }

    return successResponse(null, "Dokumen berhasil dihapus");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal hapus dokumen";
    if (msg.includes("tidak ditemukan")) return errorResponse(msg, 404);
    if (msg.includes("sudah ada pembayaran")) return errorResponse(msg, 400);
    return errorResponse(msg, 500);
  }
}
