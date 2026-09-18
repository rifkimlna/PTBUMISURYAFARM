export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { ExportButton } from "@/components/admin/print-button";
import { KeuanganContent } from "@/components/admin/keuangan-content";
import { getSaldoPerSumber } from "@/lib/keuangan-server";
import { formatRupiah } from "@/lib/utils";

export default async function KeuanganPage() {
  // Periode "30 Hari Mendatang": hari ini s/d 30 hari ke depan.
  const now = new Date();
  const awalHariIni = new Date(now);
  awalHariIni.setHours(0, 0, 0, 0);
  const akhirPeriode = new Date(now);
  akhirPeriode.setDate(akhirPeriode.getDate() + 30);
  akhirPeriode.setHours(23, 59, 59, 999);

  const [transaksi, agg, totalTransaksi, perSumber, trxMasaDepan, piutang, hutang, cookieStore] =
    await Promise.all([
      prisma.transaksiKas.findMany({
        orderBy: { tanggal: "desc" },
        take: 10,
        include: { admin: { select: { nama: true } }, _count: { select: { bukti: true } } },
      }),
      prisma.transaksiKas.groupBy({
        by: ["tipe"],
        _sum: { jumlah: true },
        _count: { id: true },
      }),
      prisma.transaksiKas.count(),
      // Saldo transfer-aware: TRANSFER keluar mengurangi asal, menambah tujuan (satu baris).
      getSaldoPerSumber(),
      // Arus kas masa depan: HANYA transaksi bertanggal SETELAH saat ini.
      // Transaksi yang sudah terjadi (termasuk yang bertanggal hari ini sebelumnya) dikecualikan.
      prisma.transaksiKas.groupBy({
        by: ["tipe"],
        where: { tanggal: { gt: now, lte: akhirPeriode } },
        _sum: { jumlah: true },
        _count: { id: true },
      }),
      // Piutang belum lunas yang jatuh tempo dalam periode (pakai sisa tagihan).
      prisma.tagihan.aggregate({
        where: {
          tipe: "PIUTANG",
          status: { not: "LUNAS" },
          jatuhTempo: { gte: awalHariIni, lte: akhirPeriode },
        },
        _sum: { sisa: true },
        _count: { id: true },
      }),
      // Hutang belum lunas yang jatuh tempo dalam periode (pakai sisa tagihan).
      prisma.tagihan.aggregate({
        where: {
          tipe: "HUTANG",
          status: { not: "LUNAS" },
          jatuhTempo: { gte: awalHariIni, lte: akhirPeriode },
        },
        _sum: { sisa: true },
        _count: { id: true },
      }),
      cookies(),
    ]);

  const token = cookieStore.get("token")?.value;
  const session = token ? await verifyToken(token) : null;
  const canDelete = session?.role === "SUPER_ADMIN";

  const pemasukan = Number(agg.find((a) => a.tipe === "PEMASUKAN")?._sum.jumlah ?? 0);
  const pengeluaran = Number(agg.find((a) => a.tipe === "PENGELUARAN")?._sum.jumlah ?? 0);

  const futureTrx = (tipe: string) =>
    Number(trxMasaDepan.find((a) => a.tipe === tipe)?._sum.jumlah ?? 0);
  const futureTrxCount = (tipe: string) =>
    trxMasaDepan.find((a) => a.tipe === tipe)?._count.id ?? 0;

  // Tanpa data yang memenuhi kriteria -> Rp0 (tanpa dummy).
  const pemasukan30Hari = futureTrx("PEMASUKAN") + Number(piutang._sum.sisa ?? 0);
  const pengeluaran30Hari = futureTrx("PENGELUARAN") + Number(hutang._sum.sisa ?? 0);
  const pemasukanCount = futureTrxCount("PEMASUKAN") + piutang._count.id;

  const saldoKasDanBank = perSumber.KAS + perSumber.BANK;

  const saldoKartuKredit = 0;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Kas & Bank
          </h1>
          <p className="mt-1 text-sm text-slate-400">Ringkasan keuangan kas dan bank PT Bumi Surya Farm</p>
        </div>
        <ExportButton />
      </div>

      <KeuanganContent
        initialData={transaksi.map((t) => ({
          id: t.id,
          tanggal: t.tanggal.toISOString(),
          tipe: t.tipe,
          kategori: t.kategori,
          kodeAkun: t.kodeAkun,
          sumberDana: t.sumberDana,
          sumberDanaTujuan: t.sumberDanaTujuan,
          noTransaksi: t.noTransaksi,
          jumlah: Number(t.jumlah),
          keterangan: t.keterangan,
          admin: { nama: t.admin.nama },
          buktiCount: t._count.bukti,
        }))}
        initialTotal={totalTransaksi}
        canDelete={canDelete}
        initialSummary={{
          pemasukan,
          pengeluaran,
          pemasukan30Hari,
          pengeluaran30Hari,
          pemasukanCount,
          perSumber: {
            KAS: perSumber.KAS,
            BANK: perSumber.BANK,
            TABUNGAN: perSumber.TABUNGAN,
            KARTU_KREDIT: saldoKartuKredit,
          },
          saldoKasDanBank,
        }}
      />
    </div>
  );
}