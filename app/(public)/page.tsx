import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { ArrowUpRight, QrCode, ShieldCheck, ArrowRight, Sprout, Fish, Bird, Building2, MapPinned } from "lucide-react";

export default async function LandingPage() {
  let stats = { pohon: 0, karyawan: 0, luas: "120 Ha", varietas: 4 };
  try {
    const [pohonCount, karyawanCount] = await Promise.all([prisma.pohon.count(), prisma.karyawan.count()]);
    stats.pohon = pohonCount;
    stats.karyawan = karyawanCount;
  } catch {}

  return (
    <div className="bg-[#FCFCFD] overflow-x-hidden">
      {/* HERO - fluid height & typography untuk semua device */}
      <section className="relative flex min-h-[520px] sm:min-h-[600px] md:min-h-[680px] lg:min-h-[760px] items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=2560&q=80&auto=format&fit=crop&crop=center"
            alt="Perkebunan"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-slate-900/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-slate-900/10 to-transparent" />
        </div>
        <div className="relative mx-auto flex w-full max-w-[1280px] 2xl:max-w-[1440px] items-center justify-center px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="mx-auto max-w-4xl text-center w-full">
            <div className="inline-flex flex-wrap justify-center items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse shrink-0" />
              <span className="tracking-wide text-white font-medium">Traceability • Live</span>
              <span className="hidden sm:inline h-3 w-px bg-white/20" />
              <span className="hidden sm:inline text-white/80">1,240 pohon • Real-time</span>
            </div>
            <h1 className="mt-6 sm:mt-8 font-light leading-[0.95] tracking-[-0.04em] text-white text-[32px] xs:text-[36px] sm:text-[48px] md:text-[56px] lg:text-[68px] xl:text-[76px] 2xl:text-[84px] px-2">
              Pertanian <span className="font-bold tracking-tight">presisi.</span>
            </h1>
            <p className="mx-auto mt-4 sm:mt-6 max-w-[560px] text-[14px] sm:text-[15px] md:text-base leading-6 sm:leading-7 text-white/85 px-4">
              Setiap pohon punya ID digital — scan QR untuk verifikasi varietas, blok, dan kesehatan tanpa aplikasi.
            </p>
            <div className="mt-6 sm:mt-8 flex justify-center px-4">
              <Link href="#produk" className="w-full sm:w-auto">
                <Button size="lg" className="rounded-full bg-green-700 px-8 py-6 text-sm font-medium text-white hover:bg-green-800 shadow-lg w-full sm:w-auto cursor-pointer">Lihat Produk</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TENTANG - fluid container & stack perfectly on tablet/HP */}
      <section id="tentang" className="bg-white border-y border-slate-100">
        <div className="mx-auto max-w-[1280px] 2xl:max-w-[1440px] px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 space-y-12 sm:space-y-16 md:space-y-20">
          {/* BARIS 1 — PERKEBUNAN */}
          <div className="grid gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-14 items-center">
            <div className="order-2 lg:order-1 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-semibold tracking-[0.14em] text-green-700">PERKEBUNAN • 120 HA • BLOK A–D</div>
              <h3 className="mt-2 text-[20px] sm:text-[22px] md:text-[26px] font-semibold leading-tight tracking-[-0.02em] text-slate-900">
                PT Bumi Surya Farm
                <br />
                <span className="font-light text-slate-900">Makmur Agro Terintegrasi</span>
              </h3>
              <p className="mt-3 text-[13px] sm:text-sm leading-6 text-slate-500">
                PT Bumi Surya Farm (“Perseroan”) merupakan perseroan yang menjalankan usaha di bidang perkebunan buah — Durian, Jambu, Alpukat dan 5+ komoditas lain — di 120 Ha Blok A–D. Kehadiran Perseroan adalah untuk kesinambungan produktivitas pertanian presisi dalam konsep agro terintegrasi, yang bersinergi dari hulu (pembibitan, pemetaan blok, monitoring kesehatan per pohon ID PHN-BLK-XXX) sampai hilir (panen, sortir grade, offtake). Foto lapangan → cloud (fotoUrl) dan scan QR tanpa aplikasi memastikan setiap pohon traceable dari tanam hingga panen.
              </p>
            </div>
            <div className="order-1 lg:order-2 relative overflow-hidden border border-slate-100 bg-slate-50 rounded-tr-[24px] sm:rounded-tr-[32px] rounded-bl-[24px] sm:rounded-bl-[32px] rounded-tl-none rounded-br-none">
              <img
                src="https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80&auto=format&fit=crop&crop=center"
                alt="Pohon Durian - Perkebunan PT Bumi Surya"
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          {/* BARIS 2 — PERIKANAN */}
          <div className="grid gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-14 items-center">
            <div className="relative overflow-hidden border border-slate-100 bg-slate-50 rounded-none">
              <img
                src="https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80&auto=format&fit=crop&crop=center"
                alt="Budidaya ikan di kolam PT Bumi Surya"
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] font-semibold tracking-[0.14em] text-green-700">PERIKANAN • KOLAM TERKELOLA</div>
              <h3 className="mt-2 text-[20px] sm:text-[22px] md:text-[26px] font-semibold tracking-[-0.02em] text-slate-900">
                Budidaya Ikan
                <br />
                <span className="font-light">Panen Terjadwal & Terukur</span>
              </h3>
              <p className="mt-3 text-[13px] sm:text-sm leading-6 text-slate-500">
                Unit perikanan mengelola kolam budidaya terkelola — monitoring pakan, kualitas air, dan jadwal panen tercatat harian. Hasil panen terhubung ke sistem yang sama dengan perkebunan, mendukung ketahanan pangan dan pasokan protein hewani yang berkelanjutan untuk mitra dan offtaker. Dari benih hingga panen, semua tercatat.
              </p>
            </div>
          </div>

          {/* BARIS 3 — PETERNAKAN */}
          <div className="grid gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-14 items-center">
            <div className="order-2 lg:order-1 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-semibold tracking-[0.14em] text-green-700">PETERNAKAN • AYAM & KAMBING</div>
              <h3 className="mt-2 text-[20px] sm:text-[22px] md:text-[26px] font-semibold tracking-[-0.02em] text-slate-900">
                Peternakan Terdata
                <br />
                <span className="font-light">Kandang & Kesehatan Terpantau</span>
              </h3>
              <p className="mt-3 text-[13px] sm:text-sm leading-6 text-slate-500">
                Unit peternakan Ayam & Kambing dikelola dengan kandang terdata dan riwayat kesehatan terpantau — pakan, vaksinasi, dan pertumbuhan tercatat harian. Terintegrasi dengan perkebunan (pupuk organik) dan perikanan dalam satu ekosistem 120 Ha yang sirkular dan efisien, dari hulu hingga hilir.
              </p>
            </div>
            <div className="order-1 lg:order-2 relative overflow-hidden border border-slate-100 bg-slate-50 rounded-none">
              <img
                src="https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?w=800&q=80&auto=format&fit=crop&crop=center"
                alt="Peternakan Ayam & Kambing PT Bumi Surya"
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA - responsive stack */}
      <section id="kontak" className="mx-auto max-w-[1280px] 2xl:max-w-[1440px] px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
        <div className="relative overflow-hidden rounded-2xl border border-green-300 bg-gradient-to-br from-green-700 to-green-800 px-5 sm:px-6 py-6 md:px-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative min-w-0">
            <div className="text-sm font-semibold tracking-tight text-white">Butuh demo atau kunjungan kebun?</div>
            <div className="mt-1 text-xs leading-5 text-green-50">Hubungi tim PT BUMI SURYA FARM — respon cepat via WhatsApp.</div>
          </div>
          <div className="relative flex gap-2 sm:gap-3 flex-wrap shrink-0">
            <a href="https://wa.me/628123456789" target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none">
              <Button size="sm" className="rounded-full bg-white text-green-800 hover:bg-green-50 shadow-sm w-full sm:w-auto cursor-pointer">
                WhatsApp
              </Button>
            </a>
            <Link href="/admin" className="flex-1 sm:flex-none">
              <Button size="sm" variant="ghost" className="rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white backdrop-blur w-full sm:w-auto cursor-pointer">
                Portal →
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
