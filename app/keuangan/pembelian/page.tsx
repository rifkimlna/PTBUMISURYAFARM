import { prisma } from "@/lib/prisma";
import { PembelianContent } from "@/components/admin/pembelian-content";

// Halaman Pembelian PT BST.
// Tab Faktur memakai data nyata (FakturPembelian + Tagihan HUTANG);
// tab Pengiriman/Pesanan/Penawaran/Permintaan memakai DokumenPembelian +
// PengirimanPembelian nyata. Alur: Permintaan -> Penawaran -> Pesanan (PO) ->
// Pengiriman (penerimaan) -> Faktur -> Utang -> Pembayaran -> Kas & Bank -> COA.
const TAB_VALID = ["faktur", "tukar-faktur", "pengiriman", "pesanan", "penawaran", "permintaan"] as const;

export default async function PembelianPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const initialTab = (TAB_VALID as readonly string[]).includes(sp?.tab ?? "")
    ? (sp?.tab as (typeof TAB_VALID)[number])
    : "faktur";

  const now = new Date();
  const awalHariIni = new Date(now);
  awalHariIni.setHours(0, 0, 0, 0);
  const awal30Hari = new Date(now);
  awal30Hari.setDate(awal30Hari.getDate() - 30);
  awal30Hari.setHours(0, 0, 0, 0);

  const [rows, docs, kirim, semuaReferensi] = await Promise.all([
    prisma.fakturPembelian.findMany({
      orderBy: { tanggal: "desc" },
      take: 100,
      include: {
        supplier: { select: { nama: true } },
        tagihan: { select: { id: true, status: true, sisa: true } },
      },
    }),
    prisma.dokumenPembelian.findMany({
      where: { tipe: { in: ["PESANAN", "PENAWARAN", "PERMINTAAN"] } },
      orderBy: { tanggal: "desc" },
      take: 100,
      include: {
        supplier: { select: { nama: true } },
        _count: { select: { pengiriman: true } },
      },
    }),
    prisma.pengirimanPembelian.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        supplier: { select: { nama: true } },
        pesanan: { select: { id: true, noDokumen: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.dokumenPembelian.findMany({
      take: 500,
      orderBy: { tanggal: "desc" },
      select: { tipe: true, referensiIds: true },
    }),
  ]);

  // Himpunan id yang sudah dirujuk dokumen turunan / faktur.
  const dirujukDokumen = new Set<string>();
  for (const r of semuaReferensi) {
    if (!r.referensiIds || r.referensiIds.length === 0) continue;
    for (const refId of r.referensiIds) dirujukDokumen.add(refId);
  }
  const fakturMerujuk = await prisma.fakturPembelian.findMany({
    take: 500,
    orderBy: { tanggal: "desc" },
    select: { referensiIds: true },
  });
  const dirujukFaktur = new Set<string>();
  for (const f of fakturMerujuk) {
    for (const refId of f.referensiIds ?? []) dirujukFaktur.add(refId);
  }

  // Ringkasan WAJIB dari sumber yang sama dengan tabel (FakturPembelian +
  // utang tertautnya), bukan seluruh Tagihan HUTANG — agar angka card
  // konsisten dengan isi tabel. Tanpa faktur: semua Rp0.
  const tagihanIds = rows.map((f) => f.tagihan?.id).filter((v): v is string => Boolean(v));
  const pelunasan30 =
    tagihanIds.length > 0
      ? await prisma.transaksiKas.aggregate({
          where: {
            tipe: "PENGELUARAN",
            tagihanId: { in: tagihanIds },
            tanggal: { gte: awal30Hari },
          },
          _sum: { jumlah: true },
          _count: { id: true },
        })
      : { _sum: { jumlah: null }, _count: { id: 0 } };

  let belumDibayar = 0;
  let belumDibayarCount = 0;
  let telatDibayar = 0;
  let telatDibayarCount = 0;
  for (const f of rows) {
    const st = f.tagihan?.status ?? "BELUM_LUNAS";
    if (st === "LUNAS") continue;
    const sisa = f.tagihan ? Number(f.tagihan.sisa) : Number(f.total);
    belumDibayar += sisa;
    belumDibayarCount += 1;
    if (f.jatuhTempo && new Date(f.jatuhTempo) < awalHariIni) {
      telatDibayar += sisa;
      telatDibayarCount += 1;
    }
  }

  return (
    <div className="space-y-6">
      <PembelianContent
        initialTab={initialTab}
        summary={{
          belumDibayar,
          belumDibayarCount,
          telatDibayar,
          telatDibayarCount,
          pelunasan30Hari: Number(pelunasan30._sum.jumlah ?? 0),
          pelunasan30Count: pelunasan30._count.id,
        }}
        faktur={rows.map((f) => {
          const st = (f.tagihan?.status ?? "BELUM_LUNAS") as "BELUM_LUNAS" | "LUNAS_SEBAGIAN" | "LUNAS";
          return {
            id: f.id,
            noFaktur: f.noFaktur,
            supplier: f.supplier.nama,
            tanggal: f.tanggal.toISOString(),
            jatuhTempo: f.jatuhTempo?.toISOString() ?? null,
            status: st,
            telat:
              st !== "LUNAS" && f.jatuhTempo ? new Date(f.jatuhTempo) < awalHariIni : false,
            sisa: f.tagihan ? Number(f.tagihan.sisa) : Number(f.total),
            total: Number(f.total),
            tagihanId: f.tagihan?.id ?? null,
          };
        })}
        docs={docs.map((d) => {
          let status = d.status === "DITUTUP" ? "SELESAI" : d.status;
          // Dokumen yang sudah ada turunan / faktur / pengiriman bukan lagi Belum Ditagih.
          if (status === "BELUM_DITAGIH") {
            if (d.tipe === "PESANAN" && ((d._count?.pengiriman ?? 0) > 0 || dirujukFaktur.has(d.id))) status = "SELESAI";
            else if (dirujukDokumen.has(d.id) || dirujukFaktur.has(d.id)) status = "SELESAI";
          }
          return {
            id: d.id,
            tipe: d.tipe,
            noDokumen: d.noDokumen,
            pihak: d.supplier?.nama ?? d.departemen ?? "-",
            tanggal: d.tanggal.toISOString(),
            jatuhTempo: d.jatuhTempo?.toISOString() ?? null,
            status,
            total: Number(d.total),
          };
        })}
        kirim={kirim.map((p) => ({
          id: p.id,
          noPengiriman: p.noPengiriman,
          pesananId: p.pesanan.id,
          pesananNo: p.pesanan.noDokumen,
          supplier: p.supplier.nama,
          tanggal: (p.tanggalPengiriman ?? p.createdAt).toISOString(),
          jumlahItem: p._count.items,
          // Penerimaan baru = Belum Ditagih; Selesai setelah pesanan asalnya difaktur.
          status: dirujukFaktur.has(p.pesanan.id) ? "SELESAI" : "BELUM_DITAGIH",
        }))}
      />
    </div>
  );
}
