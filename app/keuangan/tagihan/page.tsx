export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TagihanTable, type TipeTagihan } from "@/components/admin/tagihan-table";

export default async function TagihanPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: TipeTagihan = sp?.tab === "piutang" ? "PIUTANG" : "HUTANG";
  const isHutang = tab === "HUTANG";

  const tujuhHariLagi = new Date();
  tujuhHariLagi.setDate(tujuhHariLagi.getDate() + 7);

  const [rows, sisaPerTipe, jatuhTempoDekat] = await Promise.all([
    prisma.tagihan.findMany({
      where: { tipe: tab },
      orderBy: { createdAt: "desc" },
      include: { admin: { select: { nama: true } } },
    }),
    prisma.tagihan.groupBy({
      by: ["tipe"],
      where: { status: { not: "LUNAS" } },
      _sum: { sisa: true },
    }),
    prisma.tagihan.count({
      where: {
        status: { not: "LUNAS" },
        jatuhTempo: { not: null, lte: tujuhHariLagi },
      },
    }),
  ]);

  const sisaOf = (tipe: TipeTagihan) =>
    Number(sisaPerTipe.find((s) => s.tipe === tipe)?._sum.sisa ?? 0);

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Hutang & Piutang</h1>
          <p className="mt-1 text-sm text-slate-400">
            Catat tagihan dan pembayarannya — pelunasan otomatis masuk Keuangan Kas.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-medium">
          <Link
            href="/keuangan/tagihan"
            className={`rounded-full px-3 py-1 transition-colors ${
              isHutang ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Hutang
          </Link>
          <Link
            href="/keuangan/tagihan?tab=piutang"
            className={`rounded-full px-3 py-1 transition-colors ${
              !isHutang ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Piutang
          </Link>
        </div>
      </div>

      <TagihanTable
        tab={tab}
        summary={{
          totalHutang: sisaOf("HUTANG"),
          totalPiutang: sisaOf("PIUTANG"),
          jatuhTempoDekat,
        }}
        data={rows.map((t) => ({
          id: t.id,
          tipe: t.tipe,
          pihak: t.pihak,
          keterangan: t.keterangan,
          jumlah: Number(t.jumlah),
          sisa: Number(t.sisa),
          tanggal: t.tanggal.toISOString(),
          jatuhTempo: t.jatuhTempo?.toISOString() ?? null,
          status: t.status,
          adminNama: t.admin.nama,
          pembayaran: [],
        }))}
      />
    </div>
  );
}
