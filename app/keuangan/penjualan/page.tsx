import { prisma } from "@/lib/prisma";
import { PenjualanContent } from "@/components/admin/penjualan-content";

// Halaman utama modul Penjualan PT BST.
// Sumber data:
// - Tab Penagihan: Tagihan PIUTANG + DokumenPenjualan PROFORMA/TUKAR_FAKTUR.
// - Tab Pesanan/Penawaran: DokumenPenjualan per tipe.
// - Ringkasan pelunasan: TransaksiKas PEMASUKAN tertaut tagihan (tagihanId).
// Alur: Penawaran -> Pesanan -> Pengiriman -> Proforma/Tukar Faktur -> Penagihan
//   -> Piutang -> Pembayaran -> Kas & Bank -> COA.
const TAB_VALID = ["penagihan", "pengiriman", "pesanan", "penawaran"] as const;

export default async function PenjualanPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const initialTab = TAB_VALID.includes(sp?.tab as (typeof TAB_VALID)[number])
    ? (sp?.tab as (typeof TAB_VALID)[number])
    : "penagihan";

  const now = new Date();
  const awalHariIni = new Date(now);
  awalHariIni.setHours(0, 0, 0, 0);
  const awal30Hari = new Date(now);
  awal30Hari.setDate(awal30Hari.getDate() - 30);
  awal30Hari.setHours(0, 0, 0, 0);

  const [belumDibayar, telatDibayar, pelunasan30, rows, docs, docByTagihan, kirim] = await Promise.all([
    // Total sisa penagihan yang belum dibayar (termasuk lunas sebagian)
    prisma.tagihan.aggregate({
      where: { tipe: "PIUTANG", status: { not: "LUNAS" } },
      _sum: { sisa: true },
      _count: { id: true },
    }),
    // Penagihan yang lewat jatuh tempo dan belum lunas
    prisma.tagihan.aggregate({
      where: {
        tipe: "PIUTANG",
        status: { not: "LUNAS" },
        jatuhTempo: { lt: awalHariIni },
      },
      _sum: { sisa: true },
      _count: { id: true },
    }),
    // Pelunasan piutang yang diterima 30 hari terakhir (transaksi kas tertaut tagihan)
    prisma.transaksiKas.aggregate({
      where: {
        tipe: "PEMASUKAN",
        tagihanId: { not: null },
        tanggal: { gte: awal30Hari },
      },
      _sum: { jumlah: true },
      _count: { id: true },
    }),
    prisma.tagihan.findMany({
      where: { tipe: "PIUTANG" },
      orderBy: { tanggal: "desc" },
      take: 100,
      include: { admin: { select: { nama: true } } },
    }),
    // Dokumen non-penagihan untuk tab Penagihan (proforma/tukar) + tab Pesanan/Penawaran
    prisma.dokumenPenjualan.findMany({
      where: { tipe: { in: ["PESANAN", "PENAWARAN", "PROFORMA", "TUKAR_FAKTUR"] } },
      orderBy: { tanggal: "desc" },
      take: 100,
      include: { pelanggan: { select: { nama: true } } },
    }),
    // Peta tagihan -> dokumen (agar tombol edit membuka form dokumen yang sama)
    prisma.dokumenPenjualan.findMany({
      where: { tagihanId: { not: null } },
      select: { id: true, tipe: true, tagihanId: true },
    }),
    // Pengiriman nyata (tanpa transaksi keuangan) untuk tab Pengiriman
    prisma.pengirimanPenjualan.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        pelanggan: { select: { nama: true } },
        pesanan: { select: { noDokumen: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  const docMap: Record<string, { docId: string; tipe: string }> = {};
  for (const d of docByTagihan) {
    if (d.tagihanId) docMap[d.tagihanId] = { docId: d.id, tipe: d.tipe };
  }

  return (
    <div className="space-y-6">
      <PenjualanContent
        initialTab={initialTab}
        summary={{
          belumDibayar: Number(belumDibayar._sum.sisa ?? 0),
          belumDibayarCount: belumDibayar._count.id,
          telatDibayar: Number(telatDibayar._sum.sisa ?? 0),
          telatDibayarCount: telatDibayar._count.id,
          pelunasan30Hari: Number(pelunasan30._sum.jumlah ?? 0),
          pelunasan30Count: pelunasan30._count.id,
        }}
        rows={rows.map((t) => ({
          kind: "tagihan" as const,
          id: t.id,
          docId: (docMap[t.id]?.docId ?? null) as string | null,
          tanggal: t.tanggal.toISOString(),
          noInvoice: t.noInvoice,
          jenis: t.jenis,
          dokumen: t.dokumen,
          pihak: t.pihak,
          keterangan: t.keterangan,
          jatuhTempo: t.jatuhTempo?.toISOString() ?? null,
          status: t.status as "BELUM_LUNAS" | "LUNAS_SEBAGIAN" | "LUNAS",
          docStatus: null,
          sisa: Number(t.sisa),
          jumlah: Number(t.jumlah),
        }))}
        docs={docs.map((d) => ({
          id: d.id,
          tipe: d.tipe,
          noDokumen: d.noDokumen,
          pelanggan: d.pelanggan.nama,
          tanggal: d.tanggal.toISOString(),
          jatuhTempo: d.jatuhTempo?.toISOString() ?? null,
          status: d.status,
          total: Number(d.total),
        }))}
        kirim={kirim.map((p) => ({
          id: p.id,
          noPengiriman: p.noPengiriman,
          pesananNo: p.pesanan.noDokumen,
          pelanggan: p.pelanggan.nama,
          tanggal: (p.tanggalPengiriman ?? p.createdAt).toISOString(),
          jumlahItem: p._count.items,
        }))}
      />
    </div>
  );
}
