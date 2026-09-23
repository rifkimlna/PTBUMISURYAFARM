"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QrCode, Eye, Pencil, Trash2, MapPin } from "lucide-react";
import { QrModal } from "./qr-modal";
import { isRealFotoUrl } from "@/lib/utils";
import Link from "next/link";

type Pohon = {
  id: string;
  namaPohon?: string | null;
  varietas: string;
  jenis?: string | null;
  lokasiBlok: string;
  tanggalTanam: string;
  koordinat?: string | null;
  hasilPanen?: string | number | null;
  pemupukan?: string | null;
  pengobatan?: string | null;
  status: string;
  fotoGeotagUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geotagSource?: string | null;
  geotagTimestamp?: string | null;
  _count?: { riwayat: number };
  riwayatCount?: number;
};

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, any> = { SEHAT: "sehat", PERLU_PERHATIAN: "perhatian", SAKIT: "sakit", MATI: "mati" };
  return <Badge variant={map[s] || "secondary"}>{s.replace("_", " ")}</Badge>;
}

function hitungUsia(tanggalTanam: string) {
  const tanam = new Date(tanggalTanam);
  const now = new Date();
  const diffMs = now.getTime() - tanam.getTime();
  const hari = Math.max(0, Math.floor(diffMs / 86400000));
  const tahun = (hari / 365).toFixed(1);
  if (hari < 30) return `${hari} hari`;
  if (hari < 365) return `${Math.floor(hari / 30)} bln`;
  return `${tahun} thn`;
}

function HapusButton({ id, className }: { id: string; className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function hapus() {
    if (!window.confirm(`Hapus pohon ${id}? Data dan riwayat ikut terhapus.`)) return;
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`/api/pohon/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || j.error || "Gagal hapus");
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Gagal hapus");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={hapus}
      title="Hapus"
      className={className || "w-full rounded-full h-11 cursor-pointer border-slate-200 text-red-600 hover:text-red-700 hover:bg-red-50"}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

// Kartu mobile — ringkas horizontal, foto hanya thumbnail kecil
function PohonCard({ p, onQr }: { p: Pohon; onQr: (id: string) => void }) {
  const usia = hitungUsia(p.tanggalTanam);
  const hasil = p.hasilPanen != null && p.hasilPanen !== "" && Number(p.hasilPanen) > 0 ? `${Number(p.hasilPanen).toFixed(1)} KG` : "Belum panen";
  const riwayatCount = p._count?.riwayat ?? p.riwayatCount ?? 0;
  const hasGeotag = isRealFotoUrl(p.fotoGeotagUrl);
  const aksi = "flex flex-col items-center justify-center gap-0.5 h-11 rounded-xl text-[10px] font-medium cursor-pointer border-slate-200";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex gap-3 min-w-0">
        {hasGeotag ? (
          <a href={p.fotoGeotagUrl!} target="_blank" className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
            <img src={p.fotoGeotagUrl!} alt={p.namaPohon || p.id} className="h-full w-full object-cover" loading="lazy" />
          </a>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-[10px] font-medium text-slate-400">
            Tanpa<br />foto
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-mono text-[11px] font-bold tracking-tight text-slate-500 truncate">{p.id}</div>
            <span className="ml-auto shrink-0"><StatusBadge s={p.status} /></span>
          </div>
          <div className="text-sm font-semibold tracking-tight text-slate-900 truncate leading-snug">{p.namaPohon || p.jenis || p.varietas}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-px font-medium">{p.lokasiBlok}</span>
            <span className="truncate">{p.jenis || p.varietas} • {usia}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] truncate">
            <span className="font-semibold text-emerald-700 truncate">{hasil}</span>
            <span className="text-slate-300 shrink-0">|</span>
            <span className="text-slate-500 shrink-0">{riwayatCount} riwayat</span>
            {p.koordinat && (
              <>
                <span className="text-slate-300 shrink-0">|</span>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(p.koordinat)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-0.5 font-medium text-emerald-700">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">Lokasi</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 pt-2.5 mt-2.5 border-t border-slate-50">
        <Button type="button" variant="outline" size="sm" className={aksi} onClick={() => onQr(p.id)}>
          <QrCode className="h-4 w-4" /> QR
        </Button>
        <Link href={`/pohon/${p.id}`} target="_blank" className="block">
          <Button variant="outline" size="sm" className={`${aksi} w-full`} type="button">
            <Eye className="h-4 w-4" /> Lihat
          </Button>
        </Link>
        <Link href={`/perkebunan/pohon/${p.id}/edit`} className="block">
          <Button variant="outline" size="sm" className={`${aksi} w-full`} type="button">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </Link>
        <HapusButton id={p.id} className={`${aksi} w-full text-red-600 hover:text-red-700 hover:bg-red-50`} />
      </div>
    </div>
  );
}

export function PohonTable({ data }: { data: Pohon[] }) {
  const [qrId, setQrId] = useState<string | null>(null);
  return (
    <>
      {/* Mobile/Tablet: card grid auto - 1 col HP, 2 col tablet */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:hidden p-3 sm:p-4">
        {data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 col-span-full">Belum ada data pohon</div>
        ) : (
          data.map((p) => <PohonCard key={p.id} p={p} onQr={setQrId} />)
        )}
      </div>

      {/* Desktop: scrollable table */}
      <div className="hidden lg:block overflow-x-auto rounded-lg border border-slate-100 -mx-0">
        <div className="min-w-[1100px]">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">NO</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">ID</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">NAMA POHON</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">JENIS</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">RIWAYAT</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">TGL TANAM</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">BLOK</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">KOORDINAT</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">GEOTAG</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">HASIL</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">USIA</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">STATUS</TableHead>
                <TableHead className="text-right text-xs font-medium text-slate-500 whitespace-nowrap">AKSI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-slate-500 py-8">
                    Belum ada data pohon
                  </TableCell>
                </TableRow>
              ) : (
                data.map((p, idx) => {
                  const no = idx + 1;
                  const usia = hitungUsia(p.tanggalTanam);
                  const tgl = new Date(p.tanggalTanam).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
                  const hasil = p.hasilPanen != null && p.hasilPanen !== "" && Number(p.hasilPanen) > 0 ? `${Number(p.hasilPanen).toFixed(1)} KG` : "-";
                  const riwayatCount = p._count?.riwayat ?? p.riwayatCount ?? 0;
                  const koordinat = p.koordinat || "-";
                  return (
                    <TableRow key={p.id} className="border-slate-50 hover:bg-slate-50/50">
                      <TableCell className="text-xs font-medium text-slate-600">{no}</TableCell>
                      <TableCell className="font-mono text-xs font-medium tracking-tight whitespace-nowrap">{p.id}</TableCell>
                      <TableCell className="text-sm text-slate-700 whitespace-nowrap max-w-[140px] truncate" title={p.namaPohon || p.varietas}>
                        {p.namaPohon || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700 whitespace-nowrap">{p.jenis || p.varietas || "-"}</TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{riwayatCount} riwayat</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">{tgl}</TableCell>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">{p.lokasiBlok}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {p.koordinat ? (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(p.koordinat)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer" title={p.koordinat}>
                            <MapPin className="h-3 w-3" /> {koordinat.length > 18 ? koordinat.slice(0,18)+"…" : koordinat}
                          </a>
                        ) : <span className="text-slate-400">-</span>}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {isRealFotoUrl(p.fotoGeotagUrl) ? (
                          <a href={p.fotoGeotagUrl} target="_blank" className="inline-flex items-center gap-1.5 cursor-pointer">
                            <img src={p.fotoGeotagUrl} alt="geotag" className="h-8 w-8 rounded object-cover border border-emerald-200" />
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.geotagSource === "GPS" ? "bg-green-100 text-green-700" : p.geotagSource === "EXIF" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{p.geotagSource || "GPS"}</span>
                          </a>
                        ) : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Tanpa foto</span>}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700 whitespace-nowrap">{hasil}</TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">{usia}</TableCell>
                      <TableCell><StatusBadge s={p.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs cursor-pointer touch-manipulation" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQrId(p.id); }}>
                            <QrCode className="h-3.5 w-3.5" /> QR
                          </Button>
                          <Link href={`/pohon/${p.id}`} target="_blank">
                            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full cursor-pointer touch-manipulation" type="button"><Eye className="h-3.5 w-3.5" /></Button>
                          </Link>
                          <Link href={`/perkebunan/pohon/${p.id}/edit`} title="Edit">
                            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full cursor-pointer touch-manipulation" type="button"><Pencil className="h-3.5 w-3.5" /></Button>
                          </Link>
                          <HapusButton id={p.id} className="h-8 w-8 rounded-full cursor-pointer touch-manipulation text-red-600 hover:text-red-700 hover:bg-red-50" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <QrModal open={!!qrId} onOpenChange={(o) => !o && setQrId(null)} pohonId={qrId || ""} />
    </>
  );
}
