export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { ExportButton } from "@/components/admin/print-button";
import { KeuanganContent } from "@/components/admin/keuangan-content";
import { getSaldoPerSumber } from "@/lib/keuangan-server";
import { formatRupiah } from "@/lib/utils";

export default async function KeuanganPage() {
  // Periode "30 Hari Mendatang": BESOK s/d 30 hari ke depan (batas hari
  // kalender, bukan jam). Transaksi bertanggal hari ini (termasuk yang
  // stempelnya tengah hari) dihitung sudah terjadi, bukan masa depan.
  const now = new Date();
  const awalHariIni = new Date(now);
  awalHariIni.setHours(0, 0, 0, 0);
  const awalBesok = new Date(awalHariIni);
  awalBesok.setDate(awalBesok.getDate() + 1);
  const akhirPeriode = new Date(now);
  akhirPeriode.setDate(akhirPeriode.getDate() + 30);
  akhirPeriode.setHours(23, 59, 59, 999);

  // Setoran modal 31xx dikecualikan dari pemasukan/pengeluaran (bukan
  // pendapatan/beban); saldo kas per sumber tetap mencakupnya.
  const bukanModal: any = { NOT: [{ kodeAkun: { startsWith: "31" } }] };

  let dbError = false;
  let transaksi: any[] = [];
  let agg: any[] = [];
  let totalTransaksi = 0;
  let perSumber: { KAS: number; BANK: number; TABUNGAN: number } = { KAS: 0, BANK: 0, TABUNGAN: 0 };
  let trxMasaDepan: any[] = [];
  let piutang: { _sum: { sisa: number | null }; _count: { id: number } } = { _sum: { sisa: 0 }, _count: { id: 0 } };
  let hutang: { _sum: { sisa: number | null }; _count: { id: number } } = { _sum: { sisa: 0 }, _count: { id: 0 } };
  let cookieStore: any = null;

  try {
    const cookieStoreResult = await cookies();
    cookieStore = cookieStoreResult;

    const results = await Promise.all([
      prisma.transaksiKas.findMany({
        orderBy: { tanggal: "desc" },
        take: 10,
        include: { admin: { select: { nama: true } }, _count: { select: { bukti: true } } },
      }),
      prisma.transaksiKas.groupBy({
        where: bukanModal,
        by: ["tipe"],
        _sum: { jumlah: true },
        _count: { id: true },
      }),
      prisma.transaksiKas.count(),
      getSaldoPerSumber(),
      prisma.transaksiKas.groupBy({
        where: { tanggal: { gte: awalBesok, lte: akhirPeriode }, ...bukanModal },
        by: ["tipe"],
        _sum: { jumlah: true },
        _count: { id: true },
      }),
      prisma.tagihan.aggregate({
        where: {
          tipe: "PIUTANG",
          status: { not: "LUNAS" },
          jatuhTempo: { gte: awalHariIni, lte: akhirPeriode },
        },
        _sum: { sisa: true },
        _count: { id: true },
      }),
      prisma.tagihan.aggregate({
        where: {
          tipe: "HUTANG",
          status: { not: "LUNAS" },
          jatuhTempo: { gte: awalHariIni, lte: akhirPeriode },
        },
        _sum: { sisa: true },
        _count: { id: true },
      }),
    ]);

    [transaksi, agg, totalTransaksi, perSumber, trxMasaDepan, piutang, hutang] = results;
  } catch (e) {
    console.error("[keuangan/kas] database tidak terjangkau:", e instanceof Error ? e.message : e);
    dbError = true;
  }

  const token = cookieStore?.get("token")?.value;
  const session = token ? await verifyToken(token) : null;
  const canDelete = session?.role === "SUPER_ADMIN";

  const pemasukan = Number(agg.find((a) => a.tipe === "PEMASUKAN")?._sum.jumlah ?? 0);
  const pengeluaran = Number(agg.find((a) => a.tipe === "PENGELUARAN")?._sum.jumlah ?? 0);

  const futureTrx = (tipe: string) =>
    Number(trxMasaDepan.find((a) => a.tipe === tipe)?._sum.jumlah ?? 0);
  const futureTrxCount = (tipe: string) =>
    trxMasaDepan.find((a) => a.tipe === tipe)?._count.id ?? 0;

  const pemasukan30Hari = futureTrx("PEMASUKAN") + Number(piutang._sum.sisa ?? 0);
  const pengeluaran30Hari = futureTrx("PENGELUARAN") + Number(hutang._sum.sisa ?? 0);
  const pemasukanCount = futureTrxCount("PEMASUKAN") + piutang._count.id;

  const saldoKasDanBank = perSumber.KAS + perSumber.BANK;

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

      {dbError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-sm font-medium text-red-800">⚠️ Database tidak terhubung — data kas & bank mungkin kosong.</div>
          <div className="mt-1 text-xs text-red-600">Cek DATABASE_URL di Vercel Environment Variables lalu redeploy.</div>
        </div>
      )}

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
          },
          saldoKasDanBank,
        }}
      />
    </div>
  );
}