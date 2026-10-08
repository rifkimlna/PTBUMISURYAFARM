export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, MapPin, ChevronRight, ScanLine } from "lucide-react";

function statusBadge(s: string) {
  switch (s) {
    case "SEHAT":
      return <Badge variant="sehat">Sehat</Badge>;
    case "PERLU_PERHATIAN":
      return <Badge variant="perhatian">Perhatian</Badge>;
    case "SAKIT":
      return <Badge variant="sakit">Sakit</Badge>;
    case "MATI":
      return <Badge variant="mati">Mati</Badge>;
    default:
      return <Badge variant="secondary">{s}</Badge>;
  }
}

export default async function PetugasBlokPage({ params }: { params: Promise<{ blok: string }> }) {
  const { blok } = await params;
  const blokName = decodeURIComponent(blok);

  const pohon = await prisma.pohon.findMany({
    where: { lokasiBlok: blokName },
    orderBy: { id: "asc" },
    select: {
      id: true,
      namaPohon: true,
      varietas: true,
      lokasiBlok: true,
      koordinat: true,
      status: true,
      tanggalTanam: true,
      _count: { select: { riwayat: true } },
    },
  });

  return (
    <div className="space-y-4 sm:space-y-5">
      <Link href="/petugas/scan" className="inline-flex">
        <Button variant="ghost" size="sm" className="rounded-full -ml-2 -mb-1">
          <ArrowLeft className="h-4 w-4" /> Scan Lagi
        </Button>
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium tracking-widest text-slate-400">HASIL SCAN — SEMUA POHON BLOK</div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 truncate">{blokName}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{pohon.length} pohon — ketuk untuk update lapangan</p>
          </div>
          <span className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl bg-green-700 px-3 text-lg font-bold text-white">
            {pohon.length}
          </span>
        </div>
      </div>

      {pohon.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <ScanLine className="h-6 w-6 text-slate-400" />
          </div>
          <div className="mt-3 text-sm font-medium text-slate-700">Tidak ada pohon di {blokName}</div>
          <p className="mt-1 text-xs text-slate-500">Blok mungkin salah ketik atau data belum diinput admin.</p>
          <Link href="/petugas/scan" className="mt-4 inline-block">
            <Button className="h-11 rounded-full bg-green-700 hover:bg-green-800 px-6">Scan Ulang</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pohon.map((p) => (
            <Link key={p.id} href={`/petugas/pohon/${encodeURIComponent(p.id)}/lapangan`} className="block">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-green-600 active:bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold tracking-widest text-slate-500 truncate">{p.id}</span>
                  <span className="ml-auto shrink-0">{statusBadge(p.status as string)}</span>
                </div>
                <div className="mt-1.5 truncate text-[15px] font-semibold tracking-tight text-slate-900">
                  {p.namaPohon || p.varietas}
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {p.varietas} • {p._count.riwayat} riwayat
                </div>
                <div className="mt-2.5 flex items-center gap-2 border-t border-slate-50 pt-2.5">
                  {p.koordinat ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <MapPin className="h-3 w-3" /> Ada lokasi
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Tanpa lokasi</span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">
                    Update <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        Scan 1 pohon membuka seluruh blok — tidak perlu scan satu per satu.
      </p>
    </div>
  );
}
