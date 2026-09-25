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

  const [belumDibayar, telatDibayar, pelunasan30, rows, docs, docByTagihan, kirim, semuaReferensi] = await Promise.all([
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
      include: { pelanggan: { select: { nama: true } }, _count: { select: { pengiriman: true } } },
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
        pesanan: { select: { id: true, noDokumen: true, status: true } },
        _count: { select: { items: true } },
      },
    }),
    // Rantai dokumen untuk status tampilan (pesanan terkirim/ditagih -> Selesai).
    prisma.dokumenPenjualan.findMany({
      take: 500,
      orderBy: { tanggal: "desc" },
      select: { tipe: true, referensiIds: true },
    }),
  ]);

  const docMap: Record<string, { docId: string; tipe: string }> = {};
  for (const d of docByTagihan) {
    if (d.tagihanId) docMap[d.tagihanId] = { docId: d.id, tipe: d.tipe };
  }

  // Himpunan id yang sudah dirujuk dokumen turunan (untuk status tampilan).
  const dirujukOlehPenagihan = new Set<string>();
  const dirujukOlehPesanan = new Set<string>();
  for (const r of semuaReferensi) {
    if (!r.referensiIds || r.referensiIds.length === 0) continue;
    for (const refId of r.referensiIds) {
      if (r.tipe === "PENAGIHAN") dirujukOlehPenagihan.add(refId);
      else if (r.tipe === "PESANAN") dirujukOlehPesanan.add(refId);
    }
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
        docs={docs.map((d) => {
          // Normalisasi status lama ke kosakata Mekari (Pesanan/Penawaran: Belum Ditagih <-> Selesai).
          let status = d.status;
          if (d.tipe === "PESANAN" || d.tipe === "PENAWARAN") {
            if (status === "TERBUKA" || status === "PESANAN" || status === "PESANAN_PROFORMA") status = "BELUM_DITAGIH";
            else if (status === "DITUTUP") status = "SELESAI";
            // Pesanan yang sudah masuk pengiriman / sudah ditagih bukan lagi Belum Ditagih.
            if (d.tipe === "PESANAN" && status === "BELUM_DITAGIH") {
              if ((d._count?.pengiriman ?? 0) > 0 || dirujukOlehPenagihan.has(d.id)) status = "SELESAI";
            }
            // Penawaran yang sudah jadi pesanan / langsung ditagih -> Selesai.
            if (d.tipe === "PENAWARAN" && status === "BELUM_DITAGIH") {
              if (dirujukOlehPesanan.has(d.id) || dirujukOlehPenagihan.has(d.id)) status = "SELESAI";
            }
          }
          return {
            id: d.id,
            tipe: d.tipe,
            noDokumen: d.noDokumen,
            pelanggan: d.pelanggan.nama,
            tanggal: d.tanggal.toISOString(),
            jatuhTempo: d.jatuhTempo?.toISOString() ?? null,
            status,
            total: Number(d.total),
          };
        })}
        kirim={kirim.map((p) => {
          // Pengiriman baru = Belum Ditagih; menjadi Selesai setelah pesanan asalnya ditagih.
          const status = dirujukOlehPenagihan.has(p.pesanan.id) ? "SELESAI" : "BELUM_DITAGIH";
          return {
            id: p.id,
            noPengiriman: p.noPengiriman,
            pesananId: p.pesanan.id,
            pesananNo: p.pesanan.noDokumen,
            pelanggan: p.pelanggan.nama,
            tanggal: (p.tanggalPengiriman ?? p.createdAt).toISOString(),
            jumlahItem: p._count.items,
            status,
          };
        })}
      />
    </div>
  );
}
