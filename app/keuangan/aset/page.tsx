export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { hitungSusut } from "@/lib/aset";
import { AsetContent } from "@/components/admin/aset-content";

// Halaman Aset PT BST (modul Aset Tetap, route lama /keuangan/aset dipakai terus).
// Data: model Aset yang diperluas (lifecycle TERTUNDA/AKTIF/DIJUAL/DILEPAS +
// akun + penyusutan + pelepasan). Jurnal akuisisi dibuat sekali saat tambah
// aset (TransaksiKas tunai / Tagihan utang); penyusutan & pelepasan hanya
// dihitung/dicatat tanpa Kas otomatis.
export default async function AsetPage() {
  let dbError = false;
  let aset: any[] = [];
  let akun: any[] = [];
  let cookieStore: any = null;

  try {
    cookieStore = await cookies();

    const results = await Promise.all([
      prisma.aset.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.akunCOA.findMany({
        where: { isActive: true },
        select: { kode: true, nama: true, kelompok: true, golongan: true },
        orderBy: { kode: "asc" },
      }),
    ]);

    [aset, akun] = results;
  } catch (e) {
    console.error("[keuangan/aset] database tidak terjangkau:", e instanceof Error ? e.message : e);
    dbError = true;
  }

  const token = cookieStore?.get("token")?.value;
  const session = token ? await verifyToken(token) : null;
  const canDelete = session?.role === "SUPER_ADMIN";

  const akunMap = new Map(akun.map((a) => [a.kode, a]));
  const now = new Date();
  const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const rows = aset.map((a) => {
    const biaya = a.biayaAkuisisi == null ? Number(a.nilaiAset) * a.jumlah : Number(a.biayaAkuisisi);
    const tanggalAkuisisi = a.tanggalAkuisisi ?? a.tanggalPerolehan;
    const susut = hitungSusut(
      biaya,
      a.nilaiResidu == null ? 0 : Number(a.nilaiResidu),
      a.masaManfaatBulan ?? 0,
      a.metodeSusut,
      a.tanggalMulaiSusut,
      now
    );
    const akunAset = a.akunAset ? (akunMap.get(a.akunAset) ?? null) : null;
    const akunKredit = a.akunKredit ? (akunMap.get(a.akunKredit) ?? null) : null;
    const akunBeban = a.akunBebanSusut ? (akunMap.get(a.akunBebanSusut) ?? null) : null;
    const hargaJual = a.hargaJual == null ? null : Number(a.hargaJual);
    return {
      id: a.id,
      namaAset: a.namaAset,
      jumlah: a.jumlah,
      kategori: a.kategori,
      kondisi: a.kondisi,
      status: a.status,
      nilaiAset: Number(a.nilaiAset),
      tanggalPerolehan: a.tanggalPerolehan?.toISOString() ?? null,
      statusAset: a.statusAset,
      deskripsi: a.deskripsi,
      tanggalAkuisisi: tanggalAkuisisi?.toISOString() ?? null,
      biayaAkuisisi: a.biayaAkuisisi == null ? null : Number(a.biayaAkuisisi),
      biayaTampil: biaya,
      akunAset: a.akunAset,
      akunAsetNama: akunAset?.nama ?? null,
      akunKredit: a.akunKredit,
      akunKreditNama: akunKredit?.nama ?? null,
      tags: a.tags,
      noTransaksiAset: a.noTransaksiAset,
      transaksiKasId: a.transaksiKasId,
      tagihanId: a.tagihanId,
      metodeSusut: a.metodeSusut,
      masaManfaatBulan: a.masaManfaatBulan,
      nilaiResidu: a.nilaiResidu == null ? null : Number(a.nilaiResidu),
      akunBebanSusut: a.akunBebanSusut,
      akunBebanSusutNama: akunBeban?.nama ?? null,
      akunAkumulasi: a.akunAkumulasi,
      tanggalMulaiSusut: a.tanggalMulaiSusut?.toISOString() ?? null,
      susutBulanIni: susut.perBulan,
      akumulasiSusut: susut.akumulasi,
      nilaiBuku: susut.nilaiBuku,
      tanggalLepas: a.tanggalLepas?.toISOString() ?? null,
      hargaJual,
      noTransaksiLepas: a.noTransaksiLepas,
      caraLepas: a.caraLepas,
      keteranganLepas: a.keteranganLepas,
      statusPembayaran: a.statusPembayaran ?? null,
      akunPenerima: a.akunPenerima ?? null,
      untungRugi: a.untungRugi == null ? null : Math.round(Number(a.untungRugi)),
      createdAt: a.createdAt.toISOString(),
    };
  });

  return (
    <div className="space-y-6 min-w-0">
      {dbError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-sm font-medium text-red-800">⚠️ Database tidak terhubung — data aset mungkin kosong.</div>
          <div className="mt-1 text-xs text-red-600">Cek DATABASE_URL di Vercel Environment Variables lalu redeploy.</div>
        </div>
      )}
      <AsetContent
        canDelete={canDelete}
        periode={periode}
        data={rows}
        akunAsetTetap={akun
          .filter((a) => a.kelompok === "Aset" && a.golongan === "Aset Tetap")
          .map((a) => ({ kode: a.kode, nama: a.nama }))}
        akunKredit={akun
          .filter(
            (a) =>
              ["1101", "1103", "1104"].includes(a.kode) || a.kelompok === "Kewajiban"
          )
          .map((a) => ({ kode: a.kode, nama: a.nama, kelompok: a.kelompok }))}
        akunBeban={akun
          .filter((a) => a.kelompok === "Beban")
          .map((a) => ({ kode: a.kode, nama: a.nama }))}
      />
    </div>
  );
}
