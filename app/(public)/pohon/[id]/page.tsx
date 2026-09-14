import { prisma } from "@/lib/prisma";
import { isRealFotoUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Leaf, MapPinned, ArrowLeft, ShieldCheck, Camera } from "lucide-react";
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
    include: { riwayat: { orderBy: { tanggalCek: "desc" }, take: 5, include: { petugas: { select: { nama: true } } } } },
  });
  if (!pohon) notFound();
  const p = pohon as typeof pohon & {
    namaPohon: string | null; jenis: string | null; koordinat: string | null;
    hasilPanen: unknown; pemupukan: string | null; pengobatan: string | null;
    fotoGeotagUrl: string | null; latitude: number | null; longitude: number | null;
    geotagSource: string | null; geotagTimestamp: Date | null; geotagAccuracy: number | null;
  };

  const usiaHari = Math.floor((Date.now() - new Date(p.tanggalTanam).getTime()) / (1000 * 60 * 60 * 24));
  const usiaTahun = (usiaHari / 365).toFixed(1);
  const hasFoto = isRealFotoUrl(p.fotoGeotagUrl);
  const mapsUrl = p.latitude != null && p.longitude != null
    ? `https://maps.google.com/?q=${p.latitude},${p.longitude}`
    : p.koordinat
      ? `https://maps.google.com/?q=${encodeURIComponent(p.koordinat)}`
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
              {p.namaPohon || p.varietas} • {p.jenis || p.varietas} • {p.lokasiBlok}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-slate-50 px-4 py-3.5">
            <div className="text-[11px] font-medium tracking-wide text-slate-400">JENIS</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 leading-snug">{p.jenis || p.varietas}</div>
            <div className="text-xs text-slate-500">{p.namaPohon || p.varietas}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3.5">
            <div className="text-[11px] font-medium tracking-wide text-slate-400">BLOK</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{p.lokasiBlok}</div>
            {p.koordinat && <div className="truncate text-xs text-slate-500">{p.koordinat}</div>}
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3.5">
            <div className="text-[11px] font-medium tracking-wide text-slate-400">USIA</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{usiaTahun} thn</div>
            <div className="text-xs text-slate-500">{new Date(p.tanggalTanam).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
          <div className="rounded-2xl bg-green-700 px-4 py-3.5 text-white">
            <div className="text-[11px] font-medium tracking-wide text-green-100">PANEN</div>
            <div className="mt-1 text-sm font-semibold">{p.hasilPanen != null ? `${Number(p.hasilPanen).toFixed(1)} KG` : "Belum panen"}</div>
          </div>
        </div>

        {(p.pemupukan || p.pengobatan) && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-slate-200 px-4 py-3.5">
              <div className="text-[11px] font-medium tracking-wide text-slate-400">PUPUK</div>
              <div className="mt-1 text-sm text-slate-700 leading-snug line-clamp-3">{p.pemupukan || "-"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-3.5">
              <div className="text-[11px] font-medium tracking-wide text-slate-400">OBAT</div>
              <div className="mt-1 text-sm text-slate-700 leading-snug line-clamp-3">{p.pengobatan || "-"}</div>
            </div>
          </div>
        )}

        {hasFoto ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <img src={p.fotoGeotagUrl!} alt={`Foto ${p.id}`} className="h-36 w-full object-cover" />
            <div className="bg-green-700 px-4 py-2 text-white">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-semibold">
                  <MapPinned className="h-3.5 w-3.5" /> {p.latitude != null ? `${p.latitude.toFixed(6)}, ${p.longitude?.toFixed(6)}` : p.koordinat || "-"}
                </span>
                {mapsUrl && <a href={mapsUrl} target="_blank" className="shrink-0 font-semibold underline">Maps →</a>}
              </div>
              <div className="mt-0.5 text-[11px] text-green-100">
                {p.geotagSource || "GPS"}
                {p.geotagTimestamp ? ` • ${new Date(p.geotagTimestamp).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                {p.geotagAccuracy != null ? ` • ±${Math.round(p.geotagAccuracy)}m` : ""}
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
          <span className="font-semibold text-green-800">Terverifikasi</span>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Camera className="h-4 w-4 text-slate-400" /> Riwayat
            <span className="ml-auto text-xs font-normal text-slate-400">{p.riwayat.length}</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {p.riwayat.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                Belum ada riwayat.
              </div>
            ) : (
              p.riwayat.map((r) => (
                <div key={r.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-xs text-slate-400">{new Date(r.tanggalCek).toLocaleDateString("id-ID")} • {r.petugas.nama}</div>
                  <div className="mt-1.5 text-sm font-medium text-slate-900">{r.gejala}</div>
                  <div className="text-xs text-slate-500">→ {r.tindakan}</div>
                  {r.fotoUrl && <img src={r.fotoUrl} alt="foto riwayat" loading="lazy" className="mt-3 h-36 w-full object-cover rounded-xl" />}
                </div>
              ))
            )}
          </div>
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
