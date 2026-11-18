export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { hitungStokSaatIni, tentukanStatusStokDenganBatas } from "@/lib/persediaan";
import { ProdukContent } from "@/components/admin/produk-content";

// Halaman Produk PT BST (modul utama DATA MASTER, pengganti Persediaan Barang).
// Sumber data: PersediaanBarang + RiwayatStok (model lama dipertahankan agar
// Pembelian/Penjualan/Pengiriman tidak terganggu). Tanpa dummy: kosong berarti
// empty state.
export default async function ProdukPage() {
  let dbError = false;
  let barang: any[] = [];
  let agg: any[] = [];
  let penyesuaian: any[] = [];
  let cookieStore: any = null;

  try {
    cookieStore = await cookies();

    const results = await Promise.all([
      prisma.persediaanBarang.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.riwayatStok.groupBy({ by: ["barangId", "jenis"], _sum: { jumlah: true } }),
      prisma.riwayatStok.findMany({
        where: { sumber: "PENYESUAIAN" },
        orderBy: { tanggal: "desc" },
        take: 100,
        include: { barang: { select: { id: true, namaBarang: true, satuan: true } } },
      }),
    ]);

    [barang, agg, penyesuaian] = results;
  } catch (e) {
    console.error("[keuangan/produk] database tidak terjangkau:", e instanceof Error ? e.message : e);
    dbError = true;
  }

  const token = cookieStore?.get("token")?.value;
  const session = token ? await verifyToken(token) : null;
  const canDelete = session?.role === "SUPER_ADMIN";

  const map = new Map<string, { MASUK: number; KELUAR: number }>();
  for (const a of agg) {
    const entry = map.get(a.barangId) ?? { MASUK: 0, KELUAR: 0 };
    const jenis = a.jenis as "MASUK" | "KELUAR";
    entry[jenis] += a._sum.jumlah ?? 0;
    map.set(a.barangId, entry);
  }

  // Harga beli terakhir & rata-rata (tertimbang) dari faktur pembelian nyata
  // yang merujuk produk ini. Tanpa faktur: pakai harga tersimpan / strip.
  const ids = barang.map((b) => b.id);
  let fakturItems: any[] = [];
  try {
    fakturItems =
      ids.length > 0
        ? await prisma.fakturPembelianItem.findMany({
            where: { produkId: { in: ids } },
            select: {
              produkId: true,
              kuantitas: true,
              harga: true,
              faktur: { select: { tanggal: true } },
            },
            orderBy: { faktur: { tanggal: "desc" } },
            take: 2000,
          })
        : [];
  } catch {
    fakturItems = [];
  }
  const lastMap = new Map<string, number>();
  const sumMap = new Map<string, { nilai: number; qty: number }>();
  for (const it of fakturItems) {
    if (!it.produkId) continue;
    if (!lastMap.has(it.produkId)) lastMap.set(it.produkId, Number(it.harga));
    const acc = sumMap.get(it.produkId) ?? { nilai: 0, qty: 0 };
    const qty = Number(it.kuantitas);
    acc.nilai += Number(it.harga) * qty;
    acc.qty += qty;
    sumMap.set(it.produkId, acc);
  }

  const produk = barang.map((b) => {
    const isJasa = (b.tipeProduk ?? "BARANG") === "JASA";
    const sums = map.get(b.id) ?? { MASUK: 0, KELUAR: 0 };
    const stok = isJasa
      ? null
      : hitungStokSaatIni(b.stokAwal, [
          { jenis: "MASUK", jumlah: sums.MASUK },
          { jenis: "KELUAR", jumlah: sums.KELUAR },
        ]);
    const acc = sumMap.get(b.id);
    return {
      id: b.id,
      namaBarang: b.namaBarang,
      tipeProduk: b.tipeProduk ?? "BARANG",
      sumberProduk: (b.sumberProduk ?? null) as "PENJUALAN" | "PEMBELIAN" | null,
      barcode: b.barcode,
      satuan: b.satuan,
      stokAwal: b.stokAwal,
      stok,
      batasMinimum: b.batasMinimum,
      hargaSatuan: Number(b.hargaSatuan),
      hargaBeli: b.hargaBeli == null ? null : Number(b.hargaBeli),
      hargaJual: b.hargaJual == null ? null : Number(b.hargaJual),
      hargaBeliTerakhir:
        b.hargaBeliTerakhirManual != null
          ? Number(b.hargaBeliTerakhirManual)
          : (lastMap.get(b.id) ?? null),
      hargaRataRata:
        b.hargaRataRataManual != null
          ? Number(b.hargaRataRataManual)
          : acc && acc.qty > 0
            ? Math.round((acc.nilai / acc.qty) * 100) / 100
            : null,
      hargaRataRataManual:
        b.hargaRataRataManual == null ? null : Number(b.hargaRataRataManual),
      hargaBeliTerakhirManual:
        b.hargaBeliTerakhirManual == null ? null : Number(b.hargaBeliTerakhirManual),
      status: isJasa ? ("Jasa" as const) : tentukanStatusStokDenganBatas(stok as number, b.batasMinimum),
      keterangan: b.keterangan,
      createdAt: b.createdAt.toISOString(),
    };
  });

  const barangSaja = produk.filter((p) => p.tipeProduk !== "JASA");
  const summary = {
    tersedia: barangSaja.filter((p) => p.status === "Tersedia").length,
    segeraHabis: barangSaja.filter((p) => p.status === "Stok Menipis").length,
    habis: barangSaja.filter((p) => p.status === "Habis").length,
    totalStok: barangSaja.reduce((s, p) => s + (p.stok ?? 0), 0),
  };

  return (
    <div className="space-y-6 min-w-0">
      {dbError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-sm font-medium text-red-800">⚠️ Database tidak terhubung — data produk mungkin kosong.</div>
          <div className="mt-1 text-xs text-red-600">Cek DATABASE_URL di Vercel Environment Variables lalu redeploy.</div>
        </div>
      )}
      <ProdukContent
        canDelete={canDelete}
        summary={summary}
        produk={produk}
        penyesuaian={penyesuaian.map((r) => ({
          id: r.id,
          tanggal: r.tanggal.toISOString(),
          barangId: r.barangId,
          barangNama: r.barang.namaBarang,
          satuan: r.barang.satuan,
          jenis: r.jenis,
          jumlah: r.jumlah,
          keterangan: r.keterangan,
          nilaiPerSatuan: r.nilaiPerSatuan != null ? Number(r.nilaiPerSatuan) : null,
        }))}
      />
    </div>
  );
}
