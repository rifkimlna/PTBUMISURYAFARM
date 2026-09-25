import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { createAsetSchema } from "@/lib/validations/keuanganValidation";
import { SUMBER_DANA_BY_KODE_AKUN } from "@/lib/aset";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { ZodError } from "zod";

// Aset - public untuk demo tanpa login
export async function GET(req: NextRequest) {
  const data = await prisma.aset.findMany({ orderBy: { createdAt: "desc" } });
  const totalNilai = data.reduce((sum, a) => sum + Number(a.nilaiAset) * a.jumlah, 0);
  return successResponse({ data, totalNilai });
}

export async function POST(req: NextRequest) {
  // tanpa login demo
  const { getSessionFromRequest } = await import("@/lib/auth");
  const sessionAwal = await getSessionFromRequest(req);
  void sessionAwal;

  try {
    const body = await req.json();
    const parsed = createAsetSchema.parse(body);
    const exists = await prisma.aset.findUnique({ where: { id: parsed.id } });
    if (exists) return errorResponse(`ID aset ${parsed.id} sudah ada`, 409);

    // Validasi akun dari COA database (tanpa COA baru).
    const [akunAset, akunKredit] = await Promise.all([
      prisma.akunCOA.findUnique({ where: { kode: parsed.akunAset.trim() } }),
      prisma.akunCOA.findUnique({ where: { kode: parsed.akunKredit.trim() } }),
    ]);
    if (!akunAset || !akunAset.isActive || akunAset.kelompok !== "Aset") {
      return errorResponse(`Akun aset ${parsed.akunAset} tidak ditemukan / nonaktif / bukan kelompok Aset`, 400);
    }
    if (!akunKredit || !akunKredit.isActive) {
      return errorResponse(`Akun yang dikreditkan ${parsed.akunKredit} tidak ditemukan atau nonaktif`, 400);
    }
    const sumberDana = SUMBER_DANA_BY_KODE_AKUN[akunKredit.kode];
    const isKredit = !sumberDana;
    if (isKredit && akunKredit.kelompok !== "Kewajiban") {
      return errorResponse(
        `Akun yang dikreditkan harus Kas (1101) / Bank (1103) / Tabungan (1104) atau kelompok Kewajiban (dipilih ${akunKredit.kode} - ${akunKredit.nama})`,
        400
      );
    }
    if (isKredit && !(parsed.kreditur?.trim())) {
      return errorResponse("Kreditur wajib diisi untuk pembelian kredit", 400);
    }

    // Penyusutan: non-depresiasi atau parameter lengkap.
    const nonDep = Boolean(parsed.nonDepresiasi);
    const metodeSusut = nonDep ? "NON_DEP" : (parsed.metodeSusut ?? null);
    if (!nonDep && !metodeSusut) {
      return errorResponse("Pilih metode penyusutan atau centang aset non-depresiasi", 400);
    }
    if (metodeSusut && metodeSusut !== "NON_DEP" && !(parsed.masaManfaatBulan ?? null)) {
      return errorResponse("Masa manfaat wajib diisi untuk aset yang disusutkan", 400);
    }
    const akunBebanKode = parsed.akunBebanSusut?.trim() || "5408";
    if (metodeSusut && metodeSusut !== "NON_DEP") {
      const akunBeban = await prisma.akunCOA.findUnique({ where: { kode: akunBebanKode } });
      if (!akunBeban || !akunBeban.isActive) {
        return errorResponse(`Akun beban penyusutan ${akunBebanKode} tidak ditemukan atau nonaktif`, 400);
      }
    }

    let adminId: string | null = (sessionAwal as { userId?: string } | null)?.userId || null;
    if (!adminId) {
      const fallback = await prisma.user.findFirst({ select: { id: true } });
      adminId = fallback?.id || null;
    }
    if (!adminId) return errorResponse("Admin tidak ditemukan", 500);

    const tanggalAkuisisi: Date = parsed.tanggalAkuisisi as Date;
    const biaya = parsed.biayaAkuisisi as number;

    // Satu kejadian akuisisi = satu jurnal, tanpa ganda:
    // - Tunai: Dr akun aset, Cr Kas/Bank/Tabungan (satu TransaksiKas).
    // - Kredit: Dr akun aset, Cr utang (satu Tagihan HUTANG).
    const result = await prisma.$transaction(async (tx) => {
      const aset = await tx.aset.create({
        data: {
          id: parsed.id,
          namaAset: parsed.namaAset,
          jumlah: parsed.jumlah ?? 1,
          kategori: parsed.kategori,
          kondisi: parsed.kondisi,
          status: parsed.status ?? "Aktif",
          nilaiAset: biaya as never,
          tanggalPerolehan: tanggalAkuisisi,
          statusAset: parsed.langsungAktif ? "AKTIF" : "TERTUNDA",
          deskripsi: parsed.deskripsi?.trim() || null,
          tanggalAkuisisi,
          biayaAkuisisi: biaya as never,
          akunAset: akunAset.kode,
          akunKredit: akunKredit.kode,
          tags: parsed.tags?.trim() || null,
          metodeSusut,
          masaManfaatBulan: metodeSusut && metodeSusut !== "NON_DEP" ? (parsed.masaManfaatBulan as number) : null,
          nilaiResidu: (parsed.nilaiResidu ?? null) as never,
          akunBebanSusut: metodeSusut && metodeSusut !== "NON_DEP" ? akunBebanKode : null,
          akunAkumulasi: parsed.akunAkumulasi?.trim() || null,
          tanggalMulaiSusut:
            metodeSusut && metodeSusut !== "NON_DEP"
              ? ((parsed.tanggalMulaiSusut as Date | null | undefined) ?? tanggalAkuisisi)
              : null,
        },
      });

      let transaksiKasId: string | null = null;
      let tagihanId: string | null = null;
      if (!isKredit && sumberDana) {
        const trx = await tx.transaksiKas.create({
          data: {
            tipe: "PENGELUARAN",
            kategori: akunAset.nama,
            kodeAkun: akunAset.kode,
            sumberDana,
            jumlah: biaya as never,
            keterangan: `Akuisisi aset ${parsed.namaAset} (${parsed.id})`,
            tanggal: tanggalAkuisisi,
            adminId: adminId!,
          },
          select: { id: true },
        });
        transaksiKasId = trx.id;
      } else {
        const tagihan = await tx.tagihan.create({
          data: {
            tipe: "HUTANG",
            pihak: (parsed.kreditur as string).trim(),
            keterangan: `Akuisisi aset ${parsed.namaAset} (${parsed.id})`,
            jumlah: biaya as never,
            sisa: biaya as never,
            tanggal: tanggalAkuisisi,
            jatuhTempo: (parsed.jatuhTempo as Date | null | undefined) ?? null,
            adminId: adminId!,
          },
          select: { id: true },
        });
        tagihanId = tagihan.id;
      }

      const lengkap = await tx.aset.update({
        where: { id: aset.id },
        data: { transaksiKasId, tagihanId },
      });
      return { aset: lengkap, transaksiKasId, tagihanId };
    });

    return successResponse(
      result,
      parsed.langsungAktif ? "Aset aktif dicatat beserta jurnal akuisisinya" : "Aset tertunda dicatat beserta jurnal akuisisinya",
      201
    );
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal tambah aset", 500);
  }
}
