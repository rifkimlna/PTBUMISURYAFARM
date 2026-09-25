import { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoaDetail } from "@/components/admin/coa-detail";
import { getAkunByKodeFromDB, SUMBER_DANA_KODE_MAP } from "@/lib/coa-server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

interface PageProps {
  params: Promise<{ kode: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { kode } = await params;
  const akun = await getAkunByKodeFromDB(kode);
  if (!akun) return { title: "Akun Tidak Ditemukan" };
  return { title: `${akun.kode} - ${akun.nama} | COA | PT Bumi Surya Farm` };
}

export default async function CoaDetailPage({ params }: PageProps) {
  const { kode } = await params;
  const akun = await getAkunByKodeFromDB(kode);
  if (!akun) notFound();

  // Untuk akun sumber dana (1101 Kas, 1103 Bank, 1104 Tabungan), filter by sumberDana
  // TRANSFER tidak memiliki kode COA, jadi exclude dari detail COA
  const isSumberDanaAkun = kode in SUMBER_DANA_KODE_MAP;
  const where: Prisma.TransaksiKasWhereInput = isSumberDanaAkun
    ? { sumberDana: SUMBER_DANA_KODE_MAP[kode], tipe: { in: ["PEMASUKAN", "PENGELUARAN"] } }
    : { kodeAkun: kode };

  // Fetch initial data (page 1, no date filter)
  const [data, total, summary] = await Promise.all([
    prisma.transaksiKas.findMany({
      where,
      take: 10,
      orderBy: { tanggal: "desc" },
      include: { admin: { select: { id: true, nama: true } }, _count: { select: { bukti: true } } },
    }),
    prisma.transaksiKas.count({ where }),
    prisma.transaksiKas.groupBy({
      by: ["tipe"],
      where,
      _sum: { jumlah: true },
    }),
  ]);

  const totalMasuk = Number(summary.find((s) => s.tipe === "PEMASUKAN")?._sum.jumlah ?? 0);
  const totalKeluar = Number(summary.find((s) => s.tipe === "PENGELUARAN")?._sum.jumlah ?? 0);

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <CoaDetail
        akun={akun}
        initialData={data.map((d) => ({
          id: d.id,
          tanggal: d.tanggal.toISOString(),
          tipe: d.tipe as "PEMASUKAN" | "PENGELUARAN",
          kategori: d.kategori,
          kodeAkun: d.kodeAkun,
          sumberDana: d.sumberDana,
          jumlah: Number(d.jumlah),
          keterangan: d.keterangan,
          admin: { nama: d.admin.nama },
          buktiCount: d._count.bukti,
        }))}
        initialTotal={total}
        initialSummary={{
          pemasukan: totalMasuk,
          pengeluaran: totalKeluar,
          saldo: totalMasuk - totalKeluar,
        }}
      />
    </div>
  );
}