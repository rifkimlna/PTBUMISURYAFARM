import { prisma } from "@/lib/prisma";
import { PembelianContent } from "@/components/admin/pembelian-content";

// Halaman Pembelian PT BST.
// Tab Faktur memakai data nyata (FakturPembelian + Tagihan HUTANG);
// tab lain masih tahap UI (empty state, tanpa dummy).
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

  const rows = await prisma.fakturPembelian.findMany({
    orderBy: { tanggal: "desc" },
    take: 100,
    include: {
      supplier: { select: { nama: true } },
      tagihan: { select: { id: true, status: true, sisa: true } },
    },
  });

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
      />
    </div>
  );
}
