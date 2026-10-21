export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { BiayaContent } from "@/components/admin/biaya-content";

// Halaman Biaya PT BST.
// Menampilkan data gabungan dari model Biaya (tunai maupun hutang) serta
// TransaksiKas PENGELUARAN yang belum ditautkan ke Biaya (biaya tunai dari
// Kas & Bank yang belum ada baris Biayanya). Setiap pengeluaran dihitung
// tepat satu kali tanpa double counting.
export default async function BiayaPage() {
  const now = new Date();
  const awalBulan = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const awal30Hari = new Date(now);
  awal30Hari.setDate(awal30Hari.getDate() - 30);
  awal30Hari.setHours(0, 0, 0, 0);

  // Ambil semua id TransaksiKas yang sudah ditautkan ke Biaya (untuk dihindari duplikasi).
  const biayaKasIds = await prisma.biaya.findMany({
    where: { transaksiKasId: { not: null } },
    select: { transaksiKasId: true },
  });
  const linkedKasIds = new Set(biayaKasIds.map((b) => b.transaksiKasId!).filter(Boolean));

  const [
    bulanIni,
    tigaPuluhHari,
    belumBayar,
    kasBulanIni,
    kasTigaPuluhHari,
    biayaRows,
    kasRows,
  ] = await Promise.all([
    // Total biaya bulan ini (dari model Biaya)
    prisma.biaya.aggregate({
      where: { tanggal: { gte: awalBulan } },
      _sum: { jumlah: true },
      _count: { id: true },
    }),
    // Total biaya 30 hari terakhir (dari model Biaya)
    prisma.biaya.aggregate({
      where: { tanggal: { gte: awal30Hari } },
      _sum: { jumlah: true },
      _count: { id: true },
    }),
    // Belum lunas (sisa tagihan dari Biaya dengan tagihanId)
    prisma.biaya.aggregate({
      where: { status: { not: "LUNAS" } },
      _sum: { sisa: true },
      _count: { id: true },
    }),
    // Total biaya bulan ini dari TransaksiKas PENGELUARAN belum ditautkan ke Biaya
    prisma.transaksiKas.aggregate({
      where: {
        tipe: "PENGELUARAN",
        tanggal: { gte: awalBulan },
        id: { notIn: [...linkedKasIds] },
      },
      _sum: { jumlah: true },
      _count: { id: true },
    }),
    // Total biaya 30 hari terakhir dari TransaksiKas PENGELUARAN belum ditautkan ke Biaya
    prisma.transaksiKas.aggregate({
      where: {
        tipe: "PENGELUARAN",
        tanggal: { gte: awal30Hari },
        id: { notIn: [...linkedKasIds] },
      },
      _sum: { jumlah: true },
      _count: { id: true },
    }),
    // Baris Biaya dari model Biaya
    prisma.biaya.findMany({
      orderBy: { tanggal: "desc" },
      take: 100,
      select: {
        id: true,
        noBiaya: true,
        tanggal: true,
        kategori: true,
        kodeAkun: true,
        penerima: true,
        status: true,
        sisa: true,
        jumlah: true,
        tags: true,
        memo: true,
        tagihanId: true,
        transaksiKas: { select: { sumberDana: true } },
      },
    }),
    // TransaksiKas PENGELUARAN yang belum ditautkan ke Biaya (biaya tunai kas/bank,
    // termasuk pelunasan hutang yang langsung dibayar dari Kas & Bank).
    // Setiap pengeluaran dihitung tepat satu kali tanpa double counting.
    prisma.transaksiKas.findMany({
      where: {
        tipe: "PENGELUARAN",
        id: { notIn: [...linkedKasIds] },
      },
      orderBy: { tanggal: "desc" },
      take: 100,
      select: {
        id: true,
        noTransaksi: true,
        tanggal: true,
        kategori: true,
        kodeAkun: true,
        pihak: true,
        jumlah: true,
        sumberDana: true,
        keterangan: true,
        tagihanId: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <BiayaContent
        summary={{
          bulanIni: Number(bulanIni._sum.jumlah ?? 0) + Number(kasBulanIni._sum.jumlah ?? 0),
          bulanIniCount: bulanIni._count.id + kasBulanIni._count.id,
          tigaPuluhHari: Number(tigaPuluhHari._sum.jumlah ?? 0) + Number(kasTigaPuluhHari._sum.jumlah ?? 0),
          tigaPuluhHariCount: tigaPuluhHari._count.id + kasTigaPuluhHari._count.id,
          belumDibayar: Number(belumBayar._sum.sisa ?? 0),
          belumDibayarCount: belumBayar._count.id,
        }}
        rows={[
          ...biayaRows.map((b) => ({
            id: b.id,
            tanggal: b.tanggal.toISOString(),
            nomor: b.noBiaya,
            kategori: b.kodeAkun ? `${b.kodeAkun} - ${b.kategori}` : b.kategori,
            penerima: b.penerima,
            status: b.status as "BELUM_LUNAS" | "LUNAS_SEBAGIAN" | "LUNAS",
            sisa: Number(b.sisa),
            total: Number(b.jumlah),
            tags: b.tags,
            sumber: (b.tagihanId ? "HUTANG" : "TUNAI") as "TUNAI" | "HUTANG",
            keterangan: b.memo,
            sumberDana: b.transaksiKas?.sumberDana ?? null,
          })),
          ...kasRows.map((k) => ({
            id: k.id,
            tanggal: k.tanggal.toISOString(),
            nomor: k.noTransaksi ?? "-",
            kategori: k.kodeAkun ? `${k.kodeAkun} - ${k.kategori}` : k.kategori,
            penerima: k.pihak ?? "-",
            status: "LUNAS" as const,
            sisa: 0,
            total: Number(k.jumlah),
            tags: null,
            sumber: "KAS" as const,
            keterangan: k.keterangan,
            sumberDana: k.sumberDana,
          })),
        ]}
      />
    </div>
  );
}
