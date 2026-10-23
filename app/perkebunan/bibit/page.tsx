export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { hitungStokSaatIni, tentukanStatusStok } from "@/lib/persediaan";
import { BibitGrid, TambahBibitForm, type BibitItem } from "./actions";
import { DbErrorBanner } from "@/components/admin/db-error-banner";

export default async function BibitPage() {
  let items: BibitItem[] = [];
  let dbError = false;
  try {
    const [barang, agg] = await Promise.all([
      prisma.persediaanBarang.findMany({
        where: { kategori: "Bibit/Benih" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.riwayatStok.groupBy({ by: ["barangId", "jenis"], _sum: { jumlah: true } }),
    ]);
    const map = new Map<string, { MASUK: number; KELUAR: number }>();
    for (const a of agg) {
      const entry = map.get(a.barangId) ?? { MASUK: 0, KELUAR: 0 };
      entry[a.jenis] += a._sum.jumlah ?? 0;
      map.set(a.barangId, entry);
    }
    items = barang.map((b) => {
      const sums = map.get(b.id) ?? { MASUK: 0, KELUAR: 0 };
      const stok = hitungStokSaatIni(b.stokAwal, [
        { jenis: "MASUK", jumlah: sums.MASUK },
        { jenis: "KELUAR", jumlah: sums.KELUAR },
      ]);
      return {
        id: b.id,
        namaBarang: b.namaBarang,
        satuan: b.satuan,
        stok,
        hargaSatuan: Number(b.hargaSatuan),
        hargaJual: b.hargaJual == null ? null : Number(b.hargaJual),
        fotoUrl: b.fotoUrl,
        keterangan: b.keterangan,
        batasMinimum: b.batasMinimum,
        status: tentukanStatusStok(stok),
      };
    });
  } catch (e) {
    console.error("[perkebunan/bibit] database tidak terjangkau:", e instanceof Error ? e.message : e);
    dbError = true;
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-xl font-semibold tracking-tight text-slate-900 truncate">Bibit Dijual</h1>
          <p className="text-[11px] sm:text-sm text-slate-500">{items.length} jenis bibit • tampil di katalog home</p>
        </div>
        <div className="shrink-0 ml-auto">
          <TambahBibitForm />
        </div>
      </div>

      {dbError && <DbErrorBanner />}

      <BibitGrid items={items} />
    </div>
  );
}
