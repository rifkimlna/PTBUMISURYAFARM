export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { hitungStokSaatIni, tentukanStatusStok } from "@/lib/persediaan";
import { formatRupiah } from "@/lib/utils";
import { fotoBibit, waPesanBibit, type KatalogBibit } from "@/lib/katalog-bibit";
import { ArrowLeft, MessageCircle, Sprout } from "lucide-react";

type Params = { params: Promise<{ id: string }> };

export default async function BibitDetailPage({ params }: Params) {
  const { id } = await params;
  const b = await prisma.persediaanBarang.findUnique({ where: { id: id.toUpperCase() } }).catch(() => null);
  if (!b || b.kategori !== "Bibit/Benih") notFound();

  const agg = await prisma.riwayatStok
    .groupBy({ by: ["jenis"], where: { barangId: b.id }, _sum: { jumlah: true } })
    .catch(() => []);
  const masuk = agg.find((a) => a.jenis === "MASUK")?._sum.jumlah ?? 0;
  const keluar = agg.find((a) => a.jenis === "KELUAR")?._sum.jumlah ?? 0;
  const stok = hitungStokSaatIni(b.stokAwal, [
    { jenis: "MASUK", jumlah: masuk },
    { jenis: "KELUAR", jumlah: keluar },
  ]);
  const item: KatalogBibit = {
    id: b.id,
    nama: b.namaBarang,
    harga: b.hargaJual == null ? Number(b.hargaSatuan) : Number(b.hargaJual),
    satuan: b.satuan,
    stok,
    fotoUrl: b.fotoUrl,
    keterangan: b.keterangan,
    status: tentukanStatusStok(stok),
  };

  const lain = await prisma.persediaanBarang
    .findMany({ where: { kategori: "Bibit/Benih", id: { not: b.id } }, take: 3, orderBy: { createdAt: "desc" } })
    .catch(() => []);

  return (
    <div className="bg-[#FCFCFD]">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Link href="/#produk" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke katalog
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-10">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
            <img src={fotoBibit(item)} alt={item.nama} className="aspect-[4/3] w-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-xs text-slate-400">{item.id}</div>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">{item.nama}</h1>
            <div className="mt-3 text-2xl font-semibold text-green-800">
              Rp {formatRupiah(item.harga)} <span className="text-sm font-normal text-slate-400">/{item.satuan}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.status === "Tersedia" ? "bg-green-100 text-green-800" : item.status === "Stok Menipis" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                {item.status}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Sprout className="h-3.5 w-3.5" /> Stok: {item.stok} {item.satuan}
              </span>
            </div>
            {item.keterangan && <p className="mt-4 text-sm leading-6 text-slate-600">{item.keterangan}</p>}
            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              {item.status === "Habis" ? (
                <Button disabled className="rounded-full h-11 px-6">Stok Habis</Button>
              ) : (
                <a href={waPesanBibit(item.nama, item.id)} target="_blank" rel="noopener noreferrer">
                  <Button className="rounded-full h-11 px-6 bg-green-700 hover:bg-green-800 cursor-pointer">
                    <MessageCircle className="h-4 w-4" /> Pesan via WhatsApp
                  </Button>
                </a>
              )}
              <Link href="/#kontak">
                <Button variant="outline" className="rounded-full h-11 px-6 cursor-pointer">Tanya Partai Besar</Button>
              </Link>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-slate-400">
              Bibit dari pembibitan PT Bumi Surya Farm • Harga dapat berubah • Konfirmasi stok via WhatsApp sebelum memesan.
            </p>
          </div>
        </div>

        {lain.length > 0 && (
          <div className="mt-10 sm:mt-14">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">Bibit lainnya</h2>
            <div className="mt-4 grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
              {lain.map((x) => (
                <Link key={x.id} href={`/bibit/${x.id}`} className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  <div className="aspect-[16/9] bg-slate-50 overflow-hidden">
                    <img
                      src={x.fotoUrl || fotoBibit({ nama: x.namaBarang, fotoUrl: null })}
                      alt={x.namaBarang}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3 sm:p-4">
                    <div className="truncate text-sm font-medium text-slate-900">{x.namaBarang}</div>
                    <div className="mt-1 text-sm font-semibold text-green-800">
                      Rp {formatRupiah(x.hargaJual == null ? Number(x.hargaSatuan) : Number(x.hargaJual))} <span className="text-xs font-normal text-slate-400">/{x.satuan}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
