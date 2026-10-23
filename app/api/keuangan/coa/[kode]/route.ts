import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { z } from "zod";

const updateAkunSchema = z.object({
  nama: z.string().min(2).max(100).optional(),
  kelompok: z.enum(["Aset", "Kewajiban", "Modal", "Pendapatan", "Beban"]).optional(),
  golongan: z.string().min(2).max(100).optional(),
  deskripsi: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Minimal satu field harus diisi",
}).refine((data) => {
  if (!data.kelompok || !data.golongan) return true;
  const validGolongan: Record<string, string[]> = {
    Aset: ["Kas & Setara", "Piutang Usaha", "Persediaan", "Aset Tetap"],
    Kewajiban: ["Utang"],
    Modal: ["Modal", "Laba Ditahan"],
    Pendapatan: ["Pendapatan Usaha", "Pendapatan Lainnya"],
    Beban: [
      "Beban Tenaga Kerja",
      "Beban Produksi",
      "Beban Perlengkapan & Peralatan",
      "Beban Operasional",
      "Pelunasan Hutang",
    ],
  };
  const allowed = validGolongan[data.kelompok] || [];
  return allowed.includes(data.golongan);
}, {
  message: "Kombinasi Kelompok dan Golongan tidak valid",
  path: ["golongan"],
});

// GET /api/keuangan/coa/[kode] - get single akun
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kode: string }> }
) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  try {
    const { kode } = await params;
    const akun = await prisma.akunCOA.findUnique({
      where: { kode },
      include: { createdBy: { select: { id: true, nama: true } } },
    });

    if (!akun) {
      return errorResponse("Akun COA tidak ditemukan", 404);
    }

    return successResponse(akun);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal ambil akun", 500);
  }
}

// PUT /api/keuangan/coa/[kode] - update akun
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ kode: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session?.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  try {
    const { kode } = await params;
    const body = await req.json();
    const parsed = updateAkunSchema.parse(body);

    // Check if akun exists
    const existing = await prisma.akunCOA.findUnique({ where: { kode } });
    if (!existing) {
      return errorResponse("Akun COA tidak ditemukan", 404);
    }

    // Prevent changing kode (it's the identifier)
    // Update tipe if kelompok changes
    const tipeMap: Record<string, "PEMASUKAN" | "PENGELUARAN" | "NETRAL"> = {
      Aset: "NETRAL",
      Kewajiban: "NETRAL",
      Modal: "NETRAL",
      Pendapatan: "PEMASUKAN",
      Beban: "PENGELUARAN",
    };

    const updateData: any = { ...parsed };
    if (parsed.kelompok) {
      updateData.tipe = tipeMap[parsed.kelompok];
    }

    const akun = await prisma.akunCOA.update({
      where: { kode },
      data: updateData,
      include: { createdBy: { select: { id: true, nama: true } } },
    });

    return successResponse(akun, "Akun COA berhasil diperbarui");
  } catch (e) {
    if (e instanceof z.ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal update akun", 500);
  }
}

// DELETE /api/keuangan/coa/[kode] - delete akun
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ kode: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session?.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN"]);
  if (auth instanceof Response) return auth;

  try {
    const { kode } = await params;

    const existing = await prisma.akunCOA.findUnique({ where: { kode } });
    if (!existing) {
      return errorResponse("Akun COA tidak ditemukan", 404);
    }

    // Akun yang masih dirujuk transaksi/data tidak boleh dihapus (referensinya
    // tidak bisa dialihkan otomatis karena maknanya ikut terhapus).
    // Gunakan non-aktif (isActive=false) sebagai gantinya.
    const [kas, biaya, fakturItem, dokumenItem, persediaan, anggaran, aset] = await Promise.all([
      prisma.transaksiKas.count({ where: { kodeAkun: kode } }),
      prisma.biaya.count({ where: { kodeAkun: kode } }),
      prisma.fakturPembelianItem.count({ where: { kodeAkun: kode } }),
      prisma.dokumenPembelianItem.count({ where: { kodeAkun: kode } }),
      prisma.persediaanBarang.count({ where: { kodeAkunCOA: kode } }),
      prisma.anggaranItem.count({ where: { kodeAkun: kode } }),
      prisma.aset.count({ where: { akunAset: kode } }),
    ]);
    const dipakai = kas + biaya + fakturItem + dokumenItem + persediaan + anggaran + aset;
    if (dipakai > 0) {
      return errorResponse(
        `Akun tidak bisa dihapus karena sudah digunakan dalam ${dipakai} data. Gunakan non-aktif (isActive=false) sebagai gantinya.`,
        400
      );
    }

    // Hapus + rapatkan penomoran: semua akun numerik dalam kelompok yang sama
    // (2 digit awal sama) dengan kode di atas yang dihapus digeser maju satu
    // angka (4104->4103), beserta seluruh referensinya (kas, biaya, item
    // faktur/dokumen, persediaan, anggaran, aset) dalam satu transaksi.
    // Logika laporan memakai nama/golongan akun (bukan kode mentah) sehingga
    // angkanya tetap konsisten setelah pergeseran.
    const geser: { dari: string; ke: string; nama: string }[] = [];
    await prisma.$transaction(async (tx) => {
      await tx.akunCOA.delete({ where: { kode } });

      if (/^\d+$/.test(kode)) {
        const prefix = kode.slice(0, 2);
        const basis = parseInt(kode, 10);
        const atas = await tx.akunCOA.findMany({
          where: { kode: { startsWith: prefix } },
          select: { kode: true, nama: true },
        });
        const maju = atas
          .map((a) => a.kode)
          .filter((k) => /^\d+$/.test(k) && parseInt(k, 10) > basis)
          .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        let target = basis;
        for (const dari of maju) {
          const ke = String(target).padStart(kode.length, "0");
          target += 1;
          if (dari === ke) continue;
          await tx.akunCOA.update({ where: { kode: dari }, data: { kode: ke } });
          await tx.transaksiKas.updateMany({ where: { kodeAkun: dari }, data: { kodeAkun: ke } });
          await tx.biaya.updateMany({ where: { kodeAkun: dari }, data: { kodeAkun: ke } });
          await tx.fakturPembelianItem.updateMany({ where: { kodeAkun: dari }, data: { kodeAkun: ke } });
          await tx.dokumenPembelianItem.updateMany({ where: { kodeAkun: dari }, data: { kodeAkun: ke } });
          await tx.persediaanBarang.updateMany({ where: { kodeAkunCOA: dari }, data: { kodeAkunCOA: ke } });
          await tx.anggaranItem.updateMany({ where: { kodeAkun: dari }, data: { kodeAkun: ke } });
          await tx.aset.updateMany({ where: { akunAset: dari }, data: { akunAset: ke } });
          geser.push({ dari, ke, nama: atas.find((a) => a.kode === dari)?.nama ?? "" });
        }
      }
    });

    const infoGeser =
      geser.length > 0
        ? ` Nomor berikut digeser maju: ${geser.map((g) => `${g.dari}→${g.ke}`).join(", ")}.`
        : "";
    return successResponse({ digeser: geser }, `Akun COA berhasil dihapus.${infoGeser}`);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Gagal hapus akun", 500);
  }
}