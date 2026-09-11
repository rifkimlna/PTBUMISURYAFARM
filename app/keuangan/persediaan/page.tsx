import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { hitungStokSaatIni, tentukanStatusStok } from "@/lib/persediaan";
import { PersediaanTable } from "@/components/admin/persediaan-table";

export default async function PersediaanPage() {
  const [barang, agg, cookieStore] = await Promise.all([
    prisma.persediaanBarang.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.riwayatStok.groupBy({ by: ["barangId", "jenis"], _sum: { jumlah: true } }),
    cookies(),
  ]);

  const token = cookieStore.get("token")?.value;
  const session = token ? await verifyToken(token) : null;
  const canDelete = session?.role === "SUPER_ADMIN";

  const map = new Map<string, { MASUK: number; KELUAR: number }>();
  for (const a of agg) {
    const entry = map.get(a.barangId) ?? { MASUK: 0, KELUAR: 0 };
    entry[a.jenis] += a._sum.jumlah ?? 0;
    map.set(a.barangId, entry);
  }

  const data = barang.map((b) => {
    const sums = map.get(b.id) ?? { MASUK: 0, KELUAR: 0 };
    const stok = hitungStokSaatIni(b.stokAwal, [
      { jenis: "MASUK", jumlah: sums.MASUK },
      { jenis: "KELUAR", jumlah: sums.KELUAR },
    ]);
    const hargaSatuan = Number(b.hargaSatuan);
    return {
      id: b.id,
      namaBarang: b.namaBarang,
      kategori: b.kategori,
      stokAwal: b.stokAwal,
      stok,
      satuan: b.satuan,
      hargaSatuan,
      totalNilai: stok * hargaSatuan,
      keterangan: b.keterangan,
      status: tentukanStatusStok(stok),
      createdAt: b.createdAt.toISOString(),
    };
  });

  const summary = {
    totalJenis: data.length,
    totalStok: data.reduce((sum, d) => sum + d.stok, 0),
    nilaiPersediaan: data.reduce((sum, d) => sum + d.totalNilai, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Persediaan Barang</h1>
        <p className="mt-1 text-sm text-slate-500">Stok bibit, pupuk & obat-obatan, dan pakan ternak/ikan.</p>
      </div>
      <PersediaanTable initialData={data} initialSummary={summary} canDelete={canDelete} />
    </div>
  );
}