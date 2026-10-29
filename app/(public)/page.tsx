export const dynamic = "force-dynamic";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { hitungStokSaatIni, tentukanStatusStok } from "@/lib/persediaan";
import { formatRupiah } from "@/lib/utils";
import { fotoBibit, waPesanBibit, BIBIT_CONTOH, type KatalogBibit } from "@/lib/katalog-bibit";
import { ScanLine, MessageCircle } from "lucide-react";
import { StatItem } from "@/components/public/stat-counter";

export default async function LandingPage() {
  const stats = { pohon: 0, karyawan: 0, luas: "120 Ha", varietas: 4 };
  try {
    // Karyawan kini dari master Kontak (tabel Karyawan hanya arsip baca).
    const [pohonCount, karyawanCount] = await Promise.all([prisma.pohon.count(), prisma.kontak.count({ where: { tipe: "KARYAWAN" } })]);
    stats.pohon = pohonCount;
    stats.karyawan = karyawanCount;
  } catch {}

  // Katalog bibit: kategori Bibit/Benih dari master persediaan
  let bibit: KatalogBibit[] = [];
  try {
    const rows = await prisma.persediaanBarang.findMany({
      where: { kategori: "Bibit/Benih" },
      orderBy: { createdAt: "desc" },
      take: 3,
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
    <div className="bg-white overflow-x-hidden">
      {/* ===== HERO ala Eratani: headline besar di atas foto, garis hijau tebal ===== */}
      <section className="relative min-h-[560px] sm:min-h-[640px] lg:min-h-[720px] flex items-center justify-center overflow-hidden bg-slate-900">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=2560&q=80&auto=format&fit=crop&crop=center"
            alt="Perkebunan PT Bumi Surya Farm"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/55 to-slate-900/25" />
        </div>
        <div className="relative mx-auto w-full max-w-[1280px] 2xl:max-w-[1440px] px-4 sm:px-6 lg:px-8 py-24 sm:py-28 text-center">
          <div className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-[11px] sm:text-xs font-medium tracking-wide text-white border border-white/15">
            <span className="h-2 w-2 rounded-full bg-green-300 animate-pulse" />
            TRACEABILITY • LIVE
          </div>
          <h1 className="mt-5 sm:mt-7 mx-auto max-w-3xl text-[34px] xs:text-[40px] sm:text-[52px] md:text-[60px] leading-[1.05] tracking-[-0.03em] font-bold text-white">
            Pertanian presisi, dari hulu ke hilir.
          </h1>
          <p className="mt-4 sm:mt-5 mx-auto max-w-lg text-[14px] sm:text-base leading-6 sm:leading-7 text-white/75">
            Setiap pohon punya ID digital — scan QR untuk verifikasi, tanpa aplikasi.
          </p>
          <div className="mt-7 sm:mt-9 flex flex-wrap justify-center gap-3">
            <Link href="#produk" className="w-full sm:w-auto">
              <Button size="lg" className="rounded-full bg-white text-green-900 hover:bg-green-50 hover:text-green-900 px-8 py-6 text-sm font-semibold w-full sm:w-auto cursor-pointer">
                Jelajahi Solusi
              </Button>
            </Link>
            <Link href="/scan" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="rounded-full px-8 py-6 text-sm font-semibold bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white w-full sm:w-auto cursor-pointer">
                <ScanLine className="h-4 w-4" /> Scan QR
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== HEADLINE STATISTIK ===== */}
      <section className="bg-white">
        <div className="flex justify-center mx-auto max-w-[1280px] 2xl:max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 md:pt-20 pb-8 sm:pb-10 md:pb-12">
          <h2 className="text-center text-[14px] sm:text-[15px] md:text-[16px] font-bold tracking-[-0.01em] leading-[1.2] text-green-900 whitespace-nowrap">
            Mengintegrasikan Teknologi dan Inovasi untuk Masa Depan{" "}
            <span className="text-green-900">Perkebunan Indonesia.</span>
          </h2>
        </div>
      </section>

      {/* ===== STATISTIK ala Eratani: strip angka besar dengan counter ===== */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-[1280px] 2xl:max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-100 border-y border-slate-100">
            <div className="bg-white"><StatItem target={stats.pohon || 1240} suffix="+" label="Pohon Terdata" /></div>
            <div className="bg-white"><StatItem target={120} suffix=" Ha" label="Lahan Dikelola" /></div>
            <div className="bg-white"><StatItem target={stats.karyawan || 40} suffix="+" label="Karyawan & Mitra" /></div>
            <div className="bg-white"><StatItem target={9} suffix="+" label="Komoditas Unggul" /></div>
          </div>
        </div>
      </section>

      {/* ===== COMPANY PROFILE + VIDEO ===== */}
      <section id="profil" className="scroll-mt-16 bg-green-800 border-b border-green-900">
        <div className="mx-auto max-w-[1280px] 2xl:max-w-[1440px] px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-[11px] font-semibold tracking-[0.16em] text-green-100">COMPANY PROFILE</div>
            <h2 className="mt-3 text-[22px] sm:text-[30px] md:text-[36px] font-bold tracking-[-0.03em] leading-[1.12] text-white">
              Company Profile PT Bumi Surya Farm 2026
            </h2>
            <p className="mt-4 text-[13px] sm:text-sm leading-6 sm:leading-7 text-green-50">
              Sebagai pionir dalam industri agro terintegrasi di Indonesia, PT Bumi Surya Farm menyediakan solusi terintegrasi dan komprehensif yang mencakup seluruh rantai pertanian, dari hulu hingga hilir, melalui pendekatan Agri-Management, Agri-Input, dan Agri-Output. Perseroan terus mendorong inovasi untuk membangun ekosistem perkebunan yang lebih modern, inklusif, dan berkelanjutan.
            </p>
          </div>

          <div className="mt-8 sm:mt-10 mx-auto max-w-4xl overflow-hidden rounded-2xl border border-green-800/50 shadow-[0_4px_12px_rgba(0,0,0,0.2),0_20px_48px_rgba(0,0,0,0.25)] bg-black">
            <div className="relative aspect-video">
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube-nocookie.com/embed/v9RQKL-zRkM"
                title="Company Profile PT Bumi Surya Farm"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== KATALOG BIBIT: minimalis, kuning gelap & hijau tua ===== */}
      <section id="produk" className="scroll-mt-16 bg-[#14532d]">
        <div className="mx-auto max-w-[1280px] 2xl:max-w-[1440px] px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
          <div className="mx-auto max-w-lg text-center">
            <div className="inline-block rounded-md bg-[#a16207] px-2.5 py-1 text-[9px] font-bold tracking-[0.18em] text-white">KATALOG BIBIT</div>
            <h2 className="mt-3 text-[20px] sm:text-[26px] font-bold tracking-[-0.03em] leading-[1.12] text-white">
              Bibit Unggul, Siap Tanam
            </h2>
          </div>

          <div className="mt-7 sm:mt-8 mx-auto max-w-4xl grid gap-4 grid-cols-2 lg:grid-cols-3">
            {bibit.map((b) => {
              const habis = b.status === "Habis";
              return (
                <div key={b.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
                  <div className="relative">
                    <img src={fotoBibit(b)} alt={b.nama} className="aspect-[5/4] w-full object-cover" />
                    <span
                      className={`absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[9px] font-bold tracking-wide text-white ${
                        habis ? "bg-slate-600" : b.status === "Stok Menipis" ? "bg-[#a16207]" : "bg-green-700"
                      }`}
                    >
                      {b.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3.5">
                    <h3 className="text-[13px] sm:text-sm font-semibold leading-snug text-[#14532d]">{b.nama}</h3>
                    <div className="flex-1" />
                    <div className="text-[15px] font-bold text-[#a16207]">
                      Rp {formatRupiah(b.harga)}
                      <span className="text-[10px] font-normal text-slate-400">/{b.satuan}</span>
                    </div>
                    {habis ? (
                      <span className="block rounded-full bg-slate-100 py-1.5 text-center text-[11px] font-semibold text-slate-500">Stok Habis</span>
                    ) : (
                      <a href={waPesanBibit(b.nama, b.id)} target="_blank" rel="noopener noreferrer" className="block">
                        <span className="flex items-center justify-center gap-1.5 rounded-full bg-[#14532d] py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#1d6b3c] cursor-pointer">
                          <MessageCircle className="h-3 w-3" /> Pesan via WhatsApp
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-7 text-center">
            <Link href="/bibit">
              <Button variant="outline" className="rounded-full bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white cursor-pointer">
                Lihat Semua Bibit
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
