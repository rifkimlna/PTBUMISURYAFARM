import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthAndRole, getSessionFromRequest } from "@/lib/auth";
import { konfirmasiPembayaranSchema } from "@/lib/validations/keuanganValidation";
import { successResponse, errorResponse, zodErrorResponse } from "@/lib/api-response";
import { hitungSusut } from "@/lib/aset";

type Params = { params: Promise<{ id: string }> };

// POST /api/aset/[id]/konfirmasi-pembayaran - konfirmasi lunas untuk penjualan
// belum dibayar (DIJUAL_BELUM_DIBAYAR).
//
// Membuat TransaksiKas PEMASUKAN sekali (Dr Kas/Bank, Cr Aset Tetap) berdasarkan
// harga jual yang sudah dicatat. Memperbarui Tagihan PIUTANG menjadi LUNAS.
// Mengupdate aset: statusPembayaran = SUDAH_DIBAYAR, akunPenerima, transaksiKasJualId.
// Tidak membuat transaksi ganda: jika transaksiKasJualId sudah ada, gagal.

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuthAndRole(req, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
  if (auth instanceof Response) return auth;

  const session = await getSessionFromRequest(req);
  const adminIdFromSession = (session as { userId?: string } | null)?.userId || null;

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = konfirmasiPembayaranSchema.parse(body);

    const exists = await prisma.aset.findUnique({
      where: { id },
      select: {
        id: true,
        namaAset: true,
        statusAset: true,
        caraLepas: true,
        statusPembayaran: true,
        hargaJual: true,
        tagihanPiutangId: true,
        transaksiKasJualId: true,
        akunAset: true,
        tanggalLepas: true,
        biayaAkuisisi: true,
        nilaiAset: true,
        jumlah: true,
        nilaiResidu: true,
        masaManfaatBulan: true,
        metodeSusut: true,
        tanggalMulaiSusut: true,
      },
    });
    if (!exists) return errorResponse("Aset tidak ditemukan", 404);
    if (exists.statusAset !== "DIJUAL" && exists.statusAset !== "DILEPAS") {
      return errorResponse("Hanya aset yang sudah dijual/dilepas yang dapat dikonfirmasi", 400);
    }
    if (exists.caraLepas !== "DIJUAL") {
      return errorResponse("Hanya penjualan (Dijual) yang dapat dikonfirmasi pembayarannya", 400);
    }
    if (exists.statusPembayaran === "SUDAH_DIBAYAR") {
      return errorResponse("Pembayaran sudah dikonfirmasi sebelumnya", 400);
    }
    if (exists.transaksiKasJualId) {
      return errorResponse("Transaksi penerimaan sudah ada, tidak bisa konfirmasi ulang", 400);
    }
    if (!exists.tagihanPiutangId) {
      return errorResponse("Tagihan piutang tidak ditemukan", 400);
    }
    const hargaJualNum = Number(exists.hargaJual);
    if (!exists.hargaJual || hargaJualNum <= 0) {
      return errorResponse("Harga jual tidak valid", 400);
    }

    const tanggal = parsed.tanggalPembayaran ? new Date(parsed.tanggalPembayaran) : new Date();
    const hargaJual = hargaJualNum;

    // Hitung nilai buku s/t tanggal konfirmasi untuk catatan (tidak mengubah data)
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
    const nilaiBuku = Math.max(0, biayaAkuisisi - susut.akumulasi);

    // Validasi akun penerima
    const akunPenerimaKode = parsed.akunPenerima.trim();
    const isKasBankTabungan = ["1101", "1103", "1104"].includes(akunPenerimaKode);
    if (!isKasBankTabungan) {
      return errorResponse(
        `Akun penerima harus Kas (1101) / Bank (1103) / Tabungan (1104) (dipilih ${akunPenerimaKode})`,
        400
      );
    }
    const sumberDana =
      akunPenerimaKode === "1101" ? "KAS" : akunPenerimaKode === "1103" ? "BANK" : "TABUNGAN";

    const adminIdFinal: string | null = adminIdFromSession || (await prisma.user.findFirst({ select: { id: true } }))?.id || null;
    if (!adminIdFinal) {
      return errorResponse("Admin tidak ditemukan", 500);
    }

    const untungRugi = Math.round(hargaJual - nilaiBuku);

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Buat TransaksiKas PEMASUKAN (penerimaan kas dari penjualan)
      const trx = await tx.transaksiKas.create({
        data: {
          tipe: "PEMASUKAN",
          kategori: `Penerimaan penjualan aset - ${exists.namaAset}`,
          kodeAkun: exists.akunAset || null,
          sumberDana,
          jumlah: hargaJual,
          keterangan: `Pembayaran penjualan aset ${exists.namaAset} (${id}) - ${parsed.noTransaksi ?? ""} ${parsed.keterangan ?? ""}`.trim(),
          tanggal,
          adminId: adminIdFinal,
          noTransaksi: parsed.noTransaksi?.trim() || undefined,
        },
        select: { id: true },
      });

      // 2. Update Tagihan PIUTANG menjadi LUNAS
      const tagihanId = exists.tagihanPiutangId!;
      await tx.tagihan.update({
        where: { id: tagihanId },
        data: {
          status: "LUNAS",
          sisa: 0,
          keterangan: `Lunas - ${parsed.keterangan?.trim() || ""}`.trim() || null,
        },
      });

      // 3. Update aset: statusPembayaran, akunPenerima, transaksiKasJualId, untungRugi
      return await tx.aset.update({
        where: { id },
        data: {
          statusPembayaran: "SUDAH_DIBAYAR",
          akunPenerima: akunPenerimaKode,
          transaksiKasJualId: trx.id,
          untungRugi,
        },
      });
    });

    return successResponse(
      updated,
      "Pembayaran penjualan aset dikonfirmasi dan diterima"
    );
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return errorResponse(e instanceof Error ? e.message : "Gagal konfirmasi pembayaran", 500);
  }
}
