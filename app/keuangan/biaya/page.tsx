import { prisma } from "@/lib/prisma";
import { BiayaContent } from "@/components/admin/biaya-content";

// Halaman Biaya PT BST.
// HANYA membaca model Biaya (identitas BY-...). Faktur Pembelian,
// Pesanan, Penagihan, maupun Transaksi Kas & Bank non-Biaya TIDAK
// ditampilkan di sini — masing-masing tetap di modulnya sendiri.
// Satu transaksi Biaya dihitung tepat satu kali (sumber = baris Biaya).
export default async function BiayaPage() {
  const now = new Date();
  const awalBulan = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const awal30Hari = new Date(now);
  awal30Hari.setDate(awal30Hari.getDate() - 30);
  awal30Hari.setHours(0, 0, 0, 0);

  const [bulanIni, tigaPuluhHari, belumBayar, rows] = await Promise.all([
    prisma.biaya.aggregate({
      where: { tanggal: { gte: awalBulan } },
      _sum: { jumlah: true },
      _count: { id: true },
    }),
    prisma.biaya.aggregate({
      where: { tanggal: { gte: awal30Hari } },
      _sum: { jumlah: true },
      _count: { id: true },
    }),
    prisma.biaya.aggregate({
      where: { status: { not: "LUNAS" } },
      _sum: { sisa: true },
      _count: { id: true },
    }),
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
  ]);

  return (
    <div className="space-y-6">
      <BiayaContent
        summary={{
          bulanIni: Number(bulanIni._sum.jumlah ?? 0),
          bulanIniCount: bulanIni._count.id,
          tigaPuluhHari: Number(tigaPuluhHari._sum.jumlah ?? 0),
          tigaPuluhHariCount: tigaPuluhHari._count.id,
          belumDibayar: Number(belumBayar._sum.sisa ?? 0),
          belumDibayarCount: belumBayar._count.id,
        }}
        rows={rows.map((b) => ({
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
        }))}
      />
    </div>
  );
}
