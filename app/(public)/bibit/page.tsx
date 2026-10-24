export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hitungStokSaatIni, tentukanStatusStok } from "@/lib/persediaan";
import { formatRupiah } from "@/lib/utils";
import { fotoBibit, waPesanBibit, BIBIT_CONTOH, type KatalogBibit } from "@/lib/katalog-bibit";
import { MessageCircle } from "lucide-react";

export default async function BibitListPage() {
  let bibit: KatalogBibit[] = [];
  try {
    const rows = await prisma.persediaanBarang.findMany({
      where: { kategori: "Bibit/Benih" },
      orderBy: { createdAt: "desc" },
    });
    const agg = rows.length
      ? await prisma.riwayatStok.groupBy({
          by: ["barangId", "jenis"],
          where: { barangId: { in: rows.map((r) => r.id) } },
          _sum: { jumlah: true },
        })
      : [];
    bibit = rows.map((b) => {
      const masuk = agg.find((a) => a.barangId === b.id && a.jenis === "MASUK")?._sum.jumlah ?? 0;
      const keluar = agg.find((a) => a.barangId === b.id && a.jenis === "KELUAR")?._sum.jumlah ?? 0;
      const stok = hitungStokSaatIni(b.stokAwal, [
        { jenis: "MASUK", jumlah: masuk },
        { jenis: "KELUAR", jumlah: keluar },
      ]);
      return {
        id: b.id,
        nama: b.namaBarang,
        harga: b.hargaJual == null ? Number(b.hargaSatuan) : Number(b.hargaJual),
        satuan: b.satuan,
        stok,
        fotoUrl: b.fotoUrl,
        keterangan: b.keterangan,
        status: tentukanStatusStok(stok),
      };
    });
  } catch {}
  if (!bibit.length) bibit = BIBIT_CONTOH;

  return (
    <div className="min-h-screen bg-[#14532d]">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mx-auto max-w-xl text-center">
          <div className="inline-block rounded-md bg-[#a16207] px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-white">KATALOG BIBIT</div>
          <h1 className="mt-4 text-[22px] sm:text-[30px] font-bold tracking-[-0.03em] text-white">Bibit Unggul, Siap Tanam</h1>
        </div>

        <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-3">
          {bibit.map((b) => {
            const habis = b.status === "Habis";
            return (
              <Link key={b.id} href={`/bibit/${b.id}`} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-transform hover:-translate-y-0.5">
                <div className="relative">
                  <img src={fotoBibit(b)} alt={b.nama} className="aspect-square w-full object-cover" />
                </div>
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <h2 className="text-sm font-semibold leading-snug text-black">{b.nama}</h2>
                  <div className="flex-1" />
                  <span
                    className={`inline-block w-fit rounded-md px-2 py-0.5 text-[9px] font-bold tracking-wide text-white ${
                      habis ? "bg-slate-600" : b.status === "Stok Menipis" ? "bg-[#a16207]" : "bg-green-700"
                    }`}
                  >
                    {b.status.toUpperCase()}
                  </span>
                  <div className="text-base font-bold text-black">
                    Rp {formatRupiah(b.harga)}
                    <span className="text-[11px] font-normal text-black/60">/{b.satuan}</span>
                  </div>
                  {habis ? (
                    <span className="block rounded-full bg-slate-100 py-2 text-center text-xs font-semibold text-slate-500">Stok Habis</span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5 rounded-full bg-[#14532d] py-2 text-xs font-semibold text-white transition-colors group-hover:bg-[#1d6b3c]">
                      <MessageCircle className="h-3.5 w-3.5" /> Pesan via WhatsApp
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
