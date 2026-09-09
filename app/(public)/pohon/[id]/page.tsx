import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Leaf, MapPinned, Calendar, Activity, ArrowLeft, ShieldCheck, Camera, Sprout } from "lucide-react";
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

  const usiaHari = Math.floor((Date.now() - new Date(pohon.tanggalTanam).getTime()) / (1000 * 60 * 60 * 24));
  const usiaTahun = (usiaHari / 365).toFixed(1);

  return (
    <div className="min-h-screen bg-[#FCFCFD]">
      <div className="mx-auto max-w-[560px] px-5 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs tracking-wide text-slate-400 hover:text-slate-900">
          <ArrowLeft className="h-3.5 w-3.5" /> Beranda
        </Link>

        <div className="mt-6 overflow-hidden rounded-[24px] bg-white border border-slate-100 shadow-[0_8px_32px_rgba(16,24,40,0.06)]">
          <div className="px-6 pt-7 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                  <Leaf className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs tracking-[0.14em] text-slate-400">PT BUMI SURYA FARM • POHON</div>
                  <div className="text-lg font-semibold tracking-tight text-slate-900">{pohon.id}</div>
                  <div className="text-xs text-slate-500">{pohon.varietas} • {pohon.lokasiBlok}</div>
                </div>
              </div>
              {statusBadge(pohon.status as string)}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-1 text-[11px] tracking-wide text-slate-400">
                  <Sprout className="h-3 w-3" /> Varietas
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900 leading-tight">{pohon.varietas}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-1 text-[11px] tracking-wide text-slate-400">
                  <MapPinned className="h-3 w-3" /> Blok
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">{pohon.lokasiBlok}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-1 text-[11px] tracking-wide text-slate-400">
                  <Calendar className="h-3 w-3" /> Usia
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">{usiaTahun} thn</div>
                <div className="text-[11px] text-slate-400">{usiaHari} hari</div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-full bg-green-50 px-3 py-2 text-xs border border-green-300">
              <ShieldCheck className="h-3.5 w-3.5 text-green-800" />
              <span className="font-medium text-green-800">QR Verified</span>
              <span className="text-green-800/60">• Traceable • pt_bst live</span>
            </div>
          </div>

          <div className="border-t border-slate-50 px-6 py-6">
            <div className="flex items-center gap-2 text-sm font-medium tracking-tight text-slate-900">
              <Camera className="h-4 w-4 text-slate-400" /> Riwayat
              <span className="ml-auto text-xs font-normal text-slate-400">{pohon.riwayat.length} entri</span>
            </div>

            <div className="mt-4 space-y-3">
              {pohon.riwayat.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                  Belum ada riwayat — pemantauan rutin.
                </div>
              ) : (
                pohon.riwayat.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{new Date(r.tanggalCek).toLocaleDateString("id-ID")} • {r.petugas.nama}</span>
                      {r.fotoUrl && (
                        <a href={r.fotoUrl} target="_blank" className="font-medium text-slate-900 hover:underline">
                          Foto →
                        </a>
                      )}
                    </div>
                    <div className="mt-2 text-sm leading-5 text-slate-900">{r.gejala}</div>
                    <div className="text-xs leading-5 text-slate-500">→ {r.tindakan}</div>
                    {r.fotoUrl && <img src={r.fotoUrl} alt="foto" className="mt-3 h-36 w-full object-cover rounded-xl" />}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link href="/">
                <Button variant="outline" className="w-full rounded-full">
                  Kembali
                </Button>
              </Link>
              <a href={`https://wa.me/628123456789?text=Halo%20PT%20SURYA%20FARM%20scan%20${pohon.id}`} target="_blank">
                <Button className="w-full rounded-full bg-slate-900 hover:bg-slate-800">Hubungi</Button>
              </a>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] tracking-wide text-slate-400">Minimal • Cepat di HP • Edge cached</p>
      </div>
    </div>
  );
}
