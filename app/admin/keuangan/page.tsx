import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { ExportButton } from "@/components/admin/print-button";
import { KeuanganContent } from "@/components/admin/keuangan-content";

export default async function KeuanganPage() {
  const [transaksi, agg, totalTransaksi, cookieStore] = await Promise.all([
    prisma.transaksiKas.findMany({
      orderBy: { tanggal: "desc" },
      take: 10,
      include: { admin: { select: { nama: true } }, _count: { select: { bukti: true } } },
    }),
    prisma.transaksiKas.groupBy({ by: ["tipe"], _sum: { jumlah: true } }),
    prisma.transaksiKas.count(),
    cookies(),
  ]);

  const token = cookieStore.get("token")?.value;
  const session = token ? await verifyToken(token) : null;
  const canDelete = session?.role === "SUPER_ADMIN";

  const pemasukan = Number(agg.find((a) => a.tipe === "PEMASUKAN")?._sum.jumlah ?? 0);
  const pengeluaran = Number(agg.find((a) => a.tipe === "PENGELUARAN")?._sum.jumlah ?? 0);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Keuangan <span className="font-semibold">kas</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Ringkasan pemasukan, pengeluaran, dan saldo</p>
        </div>
        <ExportButton />
      </div>

      <KeuanganContent
        initialData={transaksi.map((t) => ({
          id: t.id,
          tanggal: t.tanggal.toISOString(),
          tipe: t.tipe,
          kategori: t.kategori,
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
          saldo: pemasukan - pengeluaran,
        }}
      />
    </div>
  );
}