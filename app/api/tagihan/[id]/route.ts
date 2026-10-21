import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { kodeAkunByNama } from "@/lib/coa";
import { getKodeAkunByNamaFromDB } from "@/lib/coa-server";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { deleteBuktiFile } from "@/lib/storage";
import {
  hapusBiayaSumber,
  hapusDokumenPenjualanSumber,
  hapusFakturPembelianSumber,
} from "@/lib/hapus-rantai";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

// Input <input type="date"> mengirim "YYYY-MM-DD" tanpa zona waktu.
// z.coerce.date() menafsirkannya sebagai tengah malam UTC sehingga
// bisa mundur sehari saat disimpan/ditampilkan. Tafsirkan sebagai
// tengah hari waktu server agar hari kalendernya stabil (WIB/UTC).
function parseTanggalKalender(val: unknown) {
  if (val === "" || val === undefined || val === null) return undefined;
  if (typeof val === "string") {
    const m = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  return val;
}

const tanggalKalenderSchema = z.preprocess(
  parseTanggalKalender,
  z.coerce.date({ message: "Tanggal tidak valid" })
);

const bayarTagihanSchema = z.object({
  jumlahBayar: z
    .number({ message: "Nominal harus angka" })
    .positive("Nominal harus positif")
    .min(1000, "Nominal minimal Rp 1.000")
    .max(10_000_000_000, "Nominal terlalu besar"),
  sumberDana: z.enum(["KAS", "BANK", "TABUNGAN"]).default("KAS"),
  tanggal: tanggalKalenderSchema.optional(),
  keterangan: z.string().trim().max(1000, "Keterangan maksimal 1000 karakter").optional().nullable(),
});

// GET /api/tagihan/[id] - detail + riwayat pembayaran
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  try {
    const tagihan = await prisma.tagihan.findUnique({
      where: { id },
      include: {
        admin: { select: { id: true, nama: true } },
        pembayaran: {
          orderBy: { createdAt: "desc" },
          include: { admin: { select: { id: true, nama: true } } },
        },
        // Dokumen Penagihan asal (sumber item produk nyata untuk Detail Produk).
        dokumenPenjualan: {
          select: {
            id: true,
            tipe: true,
            noDokumen: true,
            referensiIds: true,
            items: {
              orderBy: { id: "asc" },
              select: {
                id: true,
                produkId: true,
                deskripsi: true,
                kuantitas: true,
                unit: true,
                harga: true,
                diskonPersen: true,
                jumlah: true,
              },
            },
          },
        },
      },
    });
    if (!tagihan) return errorResponse("Tagihan tidak ditemukan", 404);

    return successResponse({
      id: tagihan.id,
      tipe: tagihan.tipe,
      pihak: tagihan.pihak,
      keterangan: tagihan.keterangan,
      jumlah: Number(tagihan.jumlah),
      sisa: Number(tagihan.sisa),
      tanggal: tagihan.tanggal.toISOString(),
      jatuhTempo: tagihan.jatuhTempo?.toISOString() ?? null,
      status: tagihan.status,
      adminNama: tagihan.admin.nama,
      noInvoice: tagihan.noInvoice,
      dokumenId: tagihan.dokumenPenjualan?.id ?? null,
      dokumenNo: tagihan.dokumenPenjualan?.noDokumen ?? null,
      referensiIds: tagihan.dokumenPenjualan?.referensiIds ?? [],
      // Detail Produk nyata dari DokumenPenjualan tertaut (bukan dummy).
      items: (tagihan.dokumenPenjualan?.items ?? []).map((it) => ({
        id: it.id,
        produkId: it.produkId,
        deskripsi: it.deskripsi,
        kuantitas: Number(it.kuantitas),
        unit: it.unit,
        harga: Number(it.harga),
        diskonPersen: Number(it.diskonPersen),
        jumlah: Number(it.jumlah),
      })),
      pembayaran: tagihan.pembayaran.map((p) => ({
        id: p.id,
        tipe: p.tipe,
        kategori: p.kategori,
        kodeAkun: p.kodeAkun,
        sumberDana: p.sumberDana,
        jumlah: Number(p.jumlah),
        keterangan: p.keterangan,
        tanggal: p.tanggal.toISOString(),
        adminNama: p.admin.nama,
      })),
    });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil tagihan", 500);
  }
}

// PUT /api/tagihan/[id] - catat pembayaran (parsial/lunas) + otomatis jadi transaksi kas
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  let adminId: string | null = (session as { userId?: string } | null)?.userId || null;
  if (!adminId) {
    const fallback = await prisma.user.findFirst({ select: { id: true } });
    adminId = fallback?.id || null;
  }
  if (!adminId) return errorResponse("Admin tidak ditemukan", 500);

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = bayarTagihanSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const tagihan = await tx.tagihan.findUnique({ where: { id } });
      if (!tagihan) throw new Error("Tagihan tidak ditemukan");
      if (tagihan.status === "LUNAS") throw new Error("Tagihan sudah lunas");

      const sisa = Number(tagihan.sisa);
      if (parsed.jumlahBayar - sisa > 0.005) {
        throw new Error(`Nominal melebihi sisa Rp ${Math.round(sisa).toLocaleString("id-ID")}`);
      }

      const isHutang = tagihan.tipe === "HUTANG";
      const kategori = isHutang ? "Pelunasan Hutang Usaha" : "Penerimaan Piutang Usaha";
      const tipeKas = isHutang ? "PENGELUARAN" : "PEMASUKAN";

      await tx.transaksiKas.create({
        data: {
          tipe: isHutang ? "PENGELUARAN" : "PEMASUKAN",
          kategori,
          // Database dulu (tahan penomoran ulang COA), lalu statis agar tetap nyambung walau nama akun diubah/di-rename.
          kodeAkun:
            (await getKodeAkunByNamaFromDB(kategori, tipeKas as any)) ??
            kodeAkunByNama(tipeKas as any, kategori),
          sumberDana: parsed.sumberDana,
          jumlah: parsed.jumlahBayar,
          keterangan:
            parsed.keterangan ??
            `${isHutang ? "Bayar" : "Terima"} ${tagihan.pihak}${tagihan.keterangan ? ` — ${tagihan.keterangan}` : ""}`,
          tanggal: parsed.tanggal ?? new Date(),
          adminId: adminId!,
          tagihanId: tagihan.id,
        },
      });

      const sisaBaru = Math.round((sisa - parsed.jumlahBayar) * 100) / 100;
      const lunas = sisaBaru <= 0.005;

      const updated = await tx.tagihan.update({
        where: { id },
        data: {
          sisa: lunas ? 0 : sisaBaru,
          status: lunas ? "LUNAS" : "LUNAS_SEBAGIAN",
        },
        include: { admin: { select: { id: true, nama: true } } },
      });

      return updated;
    });

    return successResponse(result, result.status === "LUNAS" ? "Tagihan lunas" : "Pembayaran tercatat");
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal catat pembayaran", 400);
  }
}

// DELETE /api/tagihan/[id] - hapus tagihan langsung dari halaman.
// Aturan: diblokir bila sudah ada pembayaran. Bila tertaut dokumen sumber
// (Dokumen Penjualan / Faktur Pembelian / Biaya), dokumen sumbernya ikut
// terhapus dalam satu transaksi sehingga tidak ada yatim
// (SUPER_ADMIN, ADMIN_KEUANGAN)
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  try {
    const tagihan = await prisma.tagihan.findUnique({
      where: { id },
      select: {
        id: true,
        dokumenPenjualan: { select: { id: true } },
        fakturPembelian: { select: { id: true } },
        biaya: { select: { id: true } },
      },
    });
    if (!tagihan) return errorResponse("Tagihan tidak ditemukan", 404);

    const pembayaranCount = await prisma.transaksiKas.count({ where: { tagihanId: id } });
    if (pembayaranCount > 0) {
      return errorResponse("Tagihan yang sudah ada pembayarannya tidak bisa dihapus", 400);
    }

    const hasil = await prisma.$transaction(async (tx) => {
      const ikut: string[] = [];
      let hapusUrls: string[] = [];
      // Helper sumber sudah menghapus tagihan ikutannya di dalam transaksi
      // yang sama — tagihan manual tanpa sumber dihapus di akhir.
      let tagihanTerhapus = false;
      if (tagihan.dokumenPenjualan) {
        const r = await hapusDokumenPenjualanSumber(tx, tagihan.dokumenPenjualan.id);
        ikut.push(`Dokumen ${r.label}`);
        hapusUrls = hapusUrls.concat(r.hapusUrls);
        tagihanTerhapus = true;
      }
      if (tagihan.fakturPembelian) {
        const r = await hapusFakturPembelianSumber(tx, tagihan.fakturPembelian.id);
        ikut.push(`Faktur ${r.label}`);
        hapusUrls = hapusUrls.concat(r.hapusUrls);
        tagihanTerhapus = true;
      }
      if (tagihan.biaya) {
        const r = await hapusBiayaSumber(tx, tagihan.biaya.id);
        ikut.push(`Biaya ${r.label}`);
        hapusUrls = hapusUrls.concat(r.hapusUrls);
        tagihanTerhapus = true;
      }
      if (!tagihanTerhapus) {
        await tx.tagihan.delete({ where: { id } });
      }
      return { ikut, hapusUrls };
    });

    for (const url of hasil.hapusUrls) {
      await deleteBuktiFile(url);
    }

    return successResponse(
      null,
      hasil.ikut.length > 0 ? `Tagihan dihapus (${hasil.ikut.join(", ")} ikut terhapus)` : "Tagihan dihapus"
    );
  } catch (e) {
    if ((e as { code?: string })?.code === "P2025") {
      return errorResponse("Tagihan tidak ditemukan", 404);
    }
    return errorResponse(e instanceof Error ? e.message : "Gagal hapus tagihan", 500);
  }
}
