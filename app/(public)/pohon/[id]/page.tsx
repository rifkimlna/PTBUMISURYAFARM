export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { isRealFotoUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { klasifikasiUkuran, labelKategori } from "@/lib/klasifikasi-pohon";
import { Leaf, MapPinned, ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

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
      return <Badge variant="outline">{s}</Badge>;
  }
}

export default async function PublicPohonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pohon = await prisma.pohon.findUnique({
    where: { id },
    select: {
      id: true, namaPohon: true, varietas: true, lokasiBlok: true, tanggalTanam: true,
      tinggiCm: true, status: true, fotoGeotagUrl: true, latitude: true, longitude: true,
    },
  });
  if (!pohon) notFound();
  const p = pohon as unknown as {
    id: string; namaPohon: string | null; varietas: string; lokasiBlok: string; tanggalTanam: Date;
    tinggiCm: number | null; status: string;
    fotoGeotagUrl: string | null; latitude: number | null; longitude: number | null;
  };

  // eslint-disable-next-line react-hooks/purity -- usia pohon memang dihitung saat request (server component)
  const usiaHari = Math.floor((Date.now() - new Date(p.tanggalTanam).getTime()) / (1000 * 60 * 60 * 24));
  const usiaTahun = (usiaHari / 365).toFixed(1);
  const hasFoto = isRealFotoUrl(p.fotoGeotagUrl);
  const kategori = klasifikasiUkuran(p.tinggiCm);
  const mapsUrl = p.latitude != null && p.longitude != null
    ? `https://maps.google.com/?q=${p.latitude},${p.longitude}`
    : null;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[560px] px-4 py-5 sm:py-8">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Beranda
          </Link>
          {statusBadge(p.status as string)}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-700 text-white">
            <Leaf className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium tracking-widest text-slate-400">PT BUMI SURYA FARM</div>
            <h1 className="font-mono text-xl font-bold tracking-tight text-slate-900">{p.id}</h1>
            <div className="truncate text-sm text-slate-500">
              {p.namaPohon || p.varietas} • {p.varietas} • {p.lokasiBlok}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-slate-50 px-4 py-3.5">
            <div className="text-[11px] font-medium tracking-wide text-slate-400">VARIETAS</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 leading-snug">{p.varietas}</div>
            <div className="text-xs text-slate-500">{p.namaPohon || p.varietas}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3.5">
            <div className="text-[11px] font-medium tracking-wide text-slate-400">BLOK</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{p.lokasiBlok}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3.5">
            <div className="text-[11px] font-medium tracking-wide text-slate-400">USIA</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{usiaTahun} thn</div>
            <div className="text-xs text-slate-500">{new Date(p.tanggalTanam).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
          <div className="rounded-2xl bg-green-700 px-4 py-3.5 text-white">
            <div className="text-[11px] font-medium tracking-wide text-green-100">UKURAN</div>
            <div className="mt-1 text-sm font-semibold">{p.tinggiCm != null ? `${p.tinggiCm} cm` : "Belum ukur"}</div>
            <div className="text-xs text-green-100">{labelKategori(kategori)}</div>
          </div>
        </div>

        {hasFoto ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <img src={p.fotoGeotagUrl!} alt={`Foto ${p.id}`} className="h-56 w-full object-cover" />
            <div className="bg-green-700 px-4 py-2.5 text-white">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-semibold">
                  <MapPinned className="h-3.5 w-3.5" /> Lokasi terverifikasi
                </span>
                {mapsUrl && <a href={mapsUrl} target="_blank" className="shrink-0 font-semibold underline">Maps →</a>}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex h-20 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
            Belum ada foto
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 rounded-full bg-green-50 px-4 py-2.5 text-xs border border-green-200">
          <ShieldCheck className="h-4 w-4 shrink-0 text-green-700" />
          <span className="font-semibold text-green-800">Terverifikasi PT Bumi Surya Farm</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5 pb-4">
          <Link href="/" className="block">
            <Button variant="outline" className="w-full rounded-full h-12">Kembali</Button>
          </Link>
          <a href={`https://wa.me/628123456789?text=Halo%20PT%20BUMI%20SURYA%20FARM%20(${p.id})`} target="_blank" className="block">
            <Button className="w-full rounded-full h-12 bg-green-700 hover:bg-green-800">Hubungi</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
