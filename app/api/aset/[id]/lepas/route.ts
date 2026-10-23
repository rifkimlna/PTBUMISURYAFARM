import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { lepasAsetSchema } from "@/lib/validations/keuanganValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { hitungSusut } from "@/lib/aset";

type Params = { params: Promise<{ id: string }> };

// POST /api/aset/[id]/lepas - catat penjualan/pelepasan aset aktif dengan jurnal akuntansi.
//
// Jenis pelepasan:
// - DIJUAL_SUDAH_DIBAYAR: Terima tunai, buat TransaksiKas PEMASUKAN (Dr Kas/Bank, Cr Aset Tetap),
//   wajib pilih akun penerima Kas/Bank/Tabungan dari COA.
// - DIJUAL_BELUM_DIBAYAR: Catat sebagai piutang, buat Tagihan tipe PIUTANG (Dr Piutang, Cr Aset Tetap),
//   tidak menambah saldo Kas/Bank.
// - DILEPAS_TANPA_PENJUALAN: Rusak/hilang/hibah, tidak ada penerimaan uang.
//
// Jurnal berpasangan (debit/kredit seimbang) dicatat melalui TransaksiKas untuk sisi kas/piutang,
// serta disimpan detail penyesusutan dan laba/rugi pada master aset untuk laporan terkait.
// Tidak ada transaksi ganda.

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const session = await getSessionFromRequest(req);
  const adminIdFromSession = (session as { userId?: string } | null)?.userId || null;

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = lepasAsetSchema.parse(body);
    const exists = await prisma.aset.findUnique({ where: { id } });
    if (!exists) return errorResponse("Aset tidak ditemukan", 404);
    if (exists.statusAset !== "AKTIF") {
      return errorResponse("Hanya aset aktif yang dapat dijual/dilepas", 400);
    }

    const tanggal = parsed.tanggal ? new Date(parsed.tanggal) : new Date();
    const biayaAkuisisi = exists.biayaAkuisisi
      ? Number(exists.biayaAkuisisi)
      : Number(exists.nilaiAset) * exists.jumlah;
    const susut = hitungSusut(
      biayaAkuisisi,
      exists.nilaiResidu == null ? 0 : Number(exists.nilaiResidu),
      exists.masaManfaatBulan ?? 0,
      exists.metodeSusut,
      exists.tanggalMulaiSusut ? new Date(exists.tanggalMulaiSusut) : null,
      tanggal
    );
    const akumulasiPenyusutan = susut.akumulasi;
    const nilaiBuku = Math.max(0, biayaAkuisisi - akumulasiPenyusutan);

    // Validasi akun penerima untuk sudah dibayar
    if (parsed.jenisPelepasan === "DIJUAL_SUDAH_DIBAYAR" && parsed.akunPenerima) {
      const akunPenerimaDb = await prisma.akunCOA.findUnique({
        where: { kode: parsed.akunPenerima.trim() },
      });
      if (!akunPenerimaDb || !akunPenerimaDb.isActive) {
        return errorResponse(`Akun penerima ${parsed.akunPenerima} tidak ditemukan atau nonaktif`, 400);
      }
      const isKasBankTabungan = ["1101", "1103", "1104"].includes(parsed.akunPenerima.trim());
      if (!isKasBankTabungan) {
        return errorResponse(
          `Akun penerima harus Kas (1101) / Bank (1103) / Tabungan (1104) (dipilih ${parsed.akunPenerima})`,
          400
        );
      }
    }

    let untungRugi: number | null = null;
    let transaksiKasJualId: string | null = null;
    let tagihanPiutangId: string | null = null;

    // Resolve admin ID: session user first, fallback to any user
    let adminIdFinal: string | null = adminIdFromSession;
    if (!adminIdFinal) {
      const fallback = await prisma.user.findFirst({ select: { id: true } });
      adminIdFinal = fallback?.id || null;
    }
    if (!adminIdFinal) {
      return errorResponse("Admin tidak ditemukan", 500);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.jenisPelepasan === "DIJUAL_SUDAH_DIBAYAR") {
        const hargaJual = parsed.hargaJual ?? 0;
        untungRugi = Math.round(hargaJual - nilaiBuku);

        // Akun penerima: Kas/Bank/Tabungan
        const akunPenerimaKode = parsed.akunPenerima?.trim();
        const sumberDana =
          akunPenerimaKode === "1101" ? "KAS" : akunPenerimaKode === "1103" ? "BANK" : "TABUNGAN";

        // Jurnal: Dr Kas/Bank (sumberDana), Cr Aset Tetap (kodeAkun=akunAset) = harga jual
        const trx = await tx.transaksiKas.create({
          data: {
            tipe: "PEMASUKAN",
            kategori: `Penjualan Aset Tetap - ${exists.namaAset}`,
            kodeAkun: exists.akunAset || null,
            sumberDana,
            jumlah: hargaJual,
            keterangan: `Jual aset ${exists.namaAset} (${id}) - ${parsed.noTransaksi ?? ""} ${parsed.keterangan ?? ""}`.trim(),
            tanggal,
            adminId: adminIdFinal,
            noTransaksi: parsed.noTransaksi?.trim() || undefined,
          },
          select: { id: true },
        });
        transaksiKasJualId = trx.id;

      } else if (parsed.jenisPelepasan === "DIJUAL_BELUM_DIBAYAR") {
        const hargaJual = parsed.hargaJual ?? 0;
        untungRugi = Math.round(hargaJual - nilaiBuku);

        // Jurnal: Dr Piutang (1102), Cr Aset Tetap = harga jual
        // Catat sebagai Tagihan tipe PIUTANG, tidak ada TransaksiKas (belum terima kas)
        const tagihan = await tx.tagihan.create({
          data: {
            tipe: "PIUTANG",
            pihak: parsed.keterangan?.trim() || "Pembeli Aset",
            keterangan: `Piutang penjualan aset ${exists.namaAset} (${id}) - ${parsed.noTransaksi ?? ""} ${parsed.alasanPelepasan ?? ""}`.trim(),
            jumlah: hargaJual,
            sisa: hargaJual,
            tanggal,
            jatuhTempo: null,
            status: "BELUM_LUNAS",
            adminId: adminIdFinal,
          },
          select: { id: true },
        });
        tagihanPiutangId = tagihan.id;

      } else if (parsed.jenisPelepasan === "DILEPAS_TANPA_PENJUALAN") {
        // Tidak ada penerimaan uang. Rugi = nilai buku (karena harga jual = 0)
        untungRugi = Math.round(0 - nilaiBuku);
      }

      const dataUpdate: Prisma.AsetUpdateInput = {
        statusAset: parsed.jenisPelepasan.startsWith("DIJUAL") ? "DIJUAL" : "DILEPAS",
        caraLepas: parsed.jenisPelepasan.startsWith("DIJUAL") ? "DIJUAL" : "DILEPAS",
        tanggalLepas: tanggal,
        statusPembayaran:
          parsed.jenisPelepasan === "DIJUAL_SUDAH_DIBAYAR"
            ? "SUDAH_DIBAYAR"
            : parsed.jenisPelepasan === "DIJUAL_BELUM_DIBAYAR"
              ? "BELUM_DIBAYAR"
              : "BELUM_DIKONFIRMASI",
        hargaJual:
          parsed.jenisPelepasan === "DILEPAS_TANPA_PENJUALAN" ? null : parsed.hargaJual ?? null,
        noTransaksiLepas: parsed.noTransaksi?.trim() || null,
        keteranganLepas:
          parsed.jenisPelepasan === "DILEPAS_TANPA_PENJUALAN"
            ? parsed.alasanPelepasan?.trim() || null
            : parsed.keterangan?.trim() || null,
        untungRugi,
        transaksiKasJualId,
        tagihanPiutangId,
      };

      if (parsed.jenisPelepasan === "DIJUAL_SUDAH_DIBAYAR" && parsed.akunPenerima) {
        dataUpdate.akunPenerima = parsed.akunPenerima.trim();
      }

      return await tx.aset.update({
        where: { id },
        data: dataUpdate,
      });
    });

    return successResponse(
      updated,
      parsed.jenisPelepasan === "DILEPAS_TANPA_PENJUALAN"
        ? "Pelepasan aset dicatat"
        : parsed.jenisPelepasan === "DIJUAL_SUDAH_DIBAYAR"
          ? "Penjualan aset (sudah dibayar) dicatat"
          : "Penjualan aset (belum dibayar / piutang) dicatat"
    );
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal mencatat pelepasan aset", 500);
  }
}

// DELETE /api/aset/[id]/lepas - batalkan pencatatan jual/lepas (kembali AKTIF).
// Mekanisme aman: tidak menghapus transaksi keuangan yang sudah dibuat sembarangan.
// - Jika sudah ada TransaksiKas (sudah dibayar): buat TransaksiKas PENGELUARAN pembalikan
//   dengan jumlah sama agar saldo Kas/Bank/Tabungan tetap konsisten.
// - Jika hanya ada Tagihan PIUTANG (belum dibayar): hapus Tagihan (belum affect saldo).
// Setelah itu kembalikan aset ke AKTIF dan hapus data pelepasan.
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const session = await getSessionFromRequest(req);
  const adminIdFromSession = (session as { userId?: string } | null)?.userId || null;

  const { id } = await params;
  const exists = await prisma.aset.findUnique({ where: { id } });
  if (!exists) return errorResponse("Aset tidak ditemukan", 404);
  if (exists.statusAset !== "DIJUAL" && exists.statusAset !== "DILEPAS") {
    return errorResponse("Aset tidak dalam status dijual/dilepas", 400);
  }

  // Resolve admin ID
  let adminIdFinal: string | null = adminIdFromSession;
  if (!adminIdFinal) {
    const fallback = await prisma.user.findFirst({ select: { id: true } });
    adminIdFinal = fallback?.id || null;
  }
  if (!adminIdFinal) {
    return errorResponse("Admin tidak ditemukan", 500);
  }

  await prisma.$transaction(async (tx) => {
    // 1. Jika sudah dibayar (TransaksiKas PEMASUKAN), buat pembalikan PENGELUARAN.
    if (exists.transaksiKasJualId) {
      const trxJual = await tx.transaksiKas.findUnique({
        where: { id: exists.transaksiKasJualId },
        select: { id: true, jumlah: true, sumberDana: true, tanggal: true },
      });
      if (trxJual) {
        // Tentukan sumberDanaTujuan untuk reversal: pakai sumberDana asal sebagai tujuan
        // agar mencerminkan pengeluaran dari kas yang sama.
        await tx.transaksiKas.create({
          data: {
            tipe: "PENGELUARAN",
            kategori: `Pembatalan penjualan aset - ${exists.namaAset}`,
            kodeAkun: exists.akunAset || null,
            sumberDana: trxJual.sumberDana,
            jumlah: trxJual.jumlah,
            keterangan: `Pembatalan jual aset ${exists.namaAset} (${id}) - reversi transaksi ${trxJual.id}`,
            tanggal: new Date(),
            adminId: adminIdFinal,
          },
        });
      }
    }

    // 2. Jika hanya piutang (belum dibayar), hapus Tagihan (belum affect saldo).
    if (exists.tagihanPiutangId) {
      await tx.tagihan.deleteMany({ where: { id: exists.tagihanPiutangId } });
    }

    // 3. Kembalikan aset ke AKTIF, hapus data pelepasan.
    await tx.aset.update({
      where: { id },
      data: {
        statusAset: "AKTIF",
        caraLepas: null,
        tanggalLepas: null,
        statusPembayaran: null,
        akunPenerima: null,
        hargaJual: null,
        noTransaksiLepas: null,
        keteranganLepas: null,
        untungRugi: null,
        transaksiKasJualId: null,
        tagihanPiutangId: null,
      },
    });
  });
  return successResponse(null, "Aset dikembalikan aktif");
}
