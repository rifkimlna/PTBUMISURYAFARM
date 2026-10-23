import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { createDokumenSchema } from "@/lib/validations/penjualanValidation";
import { generateNoDokumen, hitungJumlahBaris, kodeAkunPendapatanUntukJenis } from "@/lib/penjualan-server";
import { hubungkanProdukItem } from "@/lib/produk-master";
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
      // Total tukar faktur = jumlah sisa piutang yang dirujuk (bukan dari item kosong).
      let totalRujukan = 0;
      if (parsed.tipe === "TUKAR_FAKTUR") {
        const rujukan = await tx.tagihan.findMany({
          where: { id: { in: parsed.referensiIds } },
          select: { id: true, tipe: true, status: true, sisa: true },
        });
        if (rujukan.length !== parsed.referensiIds.length) {
          throw new Error("Sebagian faktur rujukan tidak ditemukan");
        }
        const invalid = rujukan.find((r) => r.tipe !== "PIUTANG" || r.status === "LUNAS");
        if (invalid) throw new Error("Rujukan harus berupa piutang yang belum lunas");
        totalRujukan = rujukan.reduce((s, r) => s + Number(r.sisa), 0);
      }

      // Hubungkan setiap baris ke master Produk: produk yang sudah terdaftar
      // dipakai ulang (abaikan besar/kecil & spasi tepi, tanpa duplikat); nama
      // baru didaftarkan otomatis sebagai PENJUALAN (hasil sendiri) agar muncul
      // di halaman Produk. Stok tidak berubah karena produk baru dibuat dengan
      // stok 0 dan tanpa riwayat stok.
      const itemsDenganSumber = parsed.items.map((it) => ({
        ...it,
        sumberProduk: "PENJUALAN" as const,
      }));
      const itemsTerhubung = await hubungkanProdukItem(tx, itemsDenganSumber);
      // Hitung ulang total di server dari baris item (otoritatif, bukan dari client).
      // Items terhubung urutannya selaras dengan itemsDenganSumber, jadi produkId
      // diambil sesuai indeks agar kolom jenis item (kuantitas/diskon) tetap utuh.
      const items = itemsDenganSumber.map((it, i) => ({
        produkId: itemsTerhubung[i]?.produkId ?? null,
        deskripsi: it.deskripsi.trim(),
        kuantitas: it.kuantitas,
        unit: it.unit.trim(),
        harga: it.harga,
        diskonPersen: it.diskonPersen ?? 0,
        jumlah: hitungJumlahBaris(it.kuantitas, it.harga, it.diskonPersen ?? 0),
      }));
      const subtotal =
        parsed.tipe === "TUKAR_FAKTUR"
          ? Math.round(totalRujukan * 100) / 100
          : Math.round(items.reduce((s, it) => s + it.jumlah, 0) * 100) / 100;

      const noDokumen = await generateNoDokumen(parsed.tipe, tanggal);

      // Hanya PENAGIHAN yang menghasilkan piutang. Tanpa transaksi Kas & Bank
      // (pelanggan belum membayar; Kas tercatat saat pembayaran via Hutang & Piutang).
      // COA otomatis: jenis penjualan → akun pendapatan (4101/4102/4104),
      // tersimpan di Tagihan.jenis (debit 1102 - Piutang, kredit akun pendapatan).
      let tagihanId: string | null = null;
      if (parsed.tipe === "PENAGIHAN") {
        const jenis = parsed.jenis ?? "LAINNYA";
        const kodePendapatan = await kodeAkunPendapatanUntukJenis(jenis);
        const akunPendapatan = kodePendapatan
          ? await tx.akunCOA.findUnique({ where: { kode: kodePendapatan } })
          : null;
        if (!akunPendapatan || !akunPendapatan.isActive) {
          throw new Error(`Akun COA ${kodePendapatan ?? `pendapatan ${jenis}`} tidak ditemukan atau nonaktif`);
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

      // Mengikuti Mekari Jurnal: Pesanan & Penawaran baru berstatus BELUM_DITAGIH.
      const statusAwal = parsed.tipe === "PESANAN" || parsed.tipe === "PENAWARAN" ? "BELUM_DITAGIH" : "TERBUKA";

      // Tandai dokumen asal selesai mengikuti alur Mekari:
      // - Penagihan dari Pesanan/Penawaran -> asal menjadi SELESAI (sudah ditagih).
      // - Pesanan dari Penawaran -> penawaran asal menjadi SELESAI.
      if (
        (parsed.tipe === "PENAGIHAN" || parsed.tipe === "PESANAN") &&
        parsed.referensiIds.length > 0
      ) {
        await tx.dokumenPenjualan.updateMany({
          where: {
            id: { in: parsed.referensiIds },
            tipe: { in: ["PESANAN", "PENAWARAN"] },
            status: { not: "SELESAI" },
          },
          data: { status: "SELESAI" },
        });
      }

      const dokumen = await tx.dokumenPenjualan.create({
        data: {
          tipe: parsed.tipe,
          status: statusAwal,
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

      // Penjualan berhasil (PENAGIHAN) mengurangi stok sesuai jumlah terjual,
      // dengan validasi stok tersedia. Transaksi lain (Penawaran/Pesanan/dsb)
      // tidak mengurangi stok.
      if (parsed.tipe === "PENAGIHAN") {
        const penjualanItems = items.filter((it) => it.produkId && it.kuantitas > 0);
        if (penjualanItems.length > 0) {
          const produkIds = [...new Set(penjualanItems.map((it) => it.produkId!).filter(Boolean))];
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
          for (const it of penjualanItems) {
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
          for (const it of penjualanItems) {
            await tx.riwayatStok.create({
              data: {
                barangId: it.produkId!,
                jenis: "KELUAR",
                jumlah: it.kuantitas,
                keterangan: `Jual via ${noDokumen}`,
                sumber: "PENJUALAN",
                tanggal,
              },
            });
          }
        }
      }

      return dokumen;
    });

    return successResponse(result, "Dokumen penjualan berhasil disimpan", 201);
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal simpan dokumen", 500);
  }
}
