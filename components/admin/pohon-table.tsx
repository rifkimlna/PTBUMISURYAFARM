"use client";
import { useState } from "react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QrCode, Eye, Pencil, ClipboardList, MapPin } from "lucide-react";
import { QrModal } from "./qr-modal";
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

// Mobile card - minimalis, gambar besar, terbaca semua kalangan, auto layout HP
function PohonCard({ p, onQr }: { p: Pohon; onQr: (id: string) => void }) {
  const usia = hitungUsia(p.tanggalTanam);
  const tgl = new Date(p.tanggalTanam).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const hasil = p.hasilPanen != null && p.hasilPanen !== "" ? `${Number(p.hasilPanen).toFixed(1)} KG` : "Belum panen";
  const riwayatCount = p._count?.riwayat ?? p.riwayatCount ?? 0;
  const hasGeotag = !!p.fotoGeotagUrl;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col">
      {/* Foto hero - auto read */}
      {hasGeotag ? (
        <a href={p.fotoGeotagUrl!} target="_blank" className="block relative">
          <img src={p.fotoGeotagUrl!} alt={p.namaPohon || p.id} className="h-44 w-full object-cover" loading="lazy" />
          <span className={`absolute left-3 top-3 text-xs px-2.5 py-1 rounded-full font-medium border bg-white/90 backdrop-blur ${p.geotagSource === "GPS" ? "text-green-700 border-green-200" : p.geotagSource === "EXIF" ? "text-blue-700 border-blue-200" : "text-amber-700 border-amber-200"}`}>{p.geotagSource || "GPS"} • {hasGeotag ? "Geotag ✓" : ""}</span>
          <span className="absolute right-3 top-3"><StatusBadge s={p.status} /></span>
        </a>
      ) : (
        <div className="h-24 w-full bg-slate-50 flex flex-col items-center justify-center gap-1 border-b border-slate-100">
          <span className="text-xs font-medium text-red-600">✗ Belum ada foto geotag</span>
          <span className="text-xs text-slate-500">Wajib foto di lapangan</span>
        </div>
      )}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="min-w-0">
          <div className="font-mono text-xs font-bold tracking-tight text-slate-500">{p.id}</div>
          <div className="text-base font-semibold tracking-tight text-slate-900 truncate leading-tight">{p.namaPohon || p.jenis || p.varietas}</div>
          <div className="text-sm text-slate-600 flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{p.lokasiBlok}</span>
            <span className="text-xs text-slate-500">{p.jenis || p.varietas} • {usia}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
            <div className="text-xs text-emerald-700 font-medium">Hasil Panen</div>
            <div className="text-sm font-semibold text-emerald-900 tracking-tight">{hasil}</div>
            <div className="text-xs text-emerald-600">{tgl}</div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
            <div className="text-xs text-slate-500 font-medium">Riwayat</div>
            <div className="text-sm font-semibold text-slate-900">{riwayatCount} entri</div>
            <div className="text-xs text-slate-500">tindakan tercatat</div>
          </div>
        </div>
        {p.koordinat && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(p.koordinat)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-medium hover:underline">
            <MapPin className="h-4 w-4" /> {p.koordinat}
          </a>
        )}
        {(p.pemupukan || p.pengobatan) && (
          <div className="text-sm text-slate-600 space-y-1 border-t border-slate-100 pt-3">
            {p.pemupukan && <div className="truncate"><span className="font-medium text-slate-700">Pupuk:</span> {p.pemupukan}</div>}
            {p.pengobatan && <div className="truncate"><span className="font-medium text-slate-700">Obat:</span> {p.pengobatan}</div>}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2 pt-2 mt-auto">
          <Button type="button" variant="outline" size="sm" className="rounded-full text-xs h-11 cursor-pointer border-slate-200" onClick={() => onQr(p.id)}>
            <QrCode className="h-4 w-4" /> QR
          </Button>
          <Link href={`/pohon/${p.id}`} target="_blank" className="block">
            <Button variant="outline" size="sm" className="w-full rounded-full h-11 cursor-pointer border-slate-200" type="button">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/perkebunan/pohon/${p.id}/edit`} className="block">
            <Button variant="outline" size="sm" className="w-full rounded-full h-11 cursor-pointer border-slate-200" type="button">
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/perkebunan/pohon/${p.id}/lapangan`} className="block">
            <Button variant="outline" size="sm" className="w-full rounded-full h-11 bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 cursor-pointer" type="button">
              <ClipboardList className="h-4 w-4" />
            </Button>
          </Link>
        </div>
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
                  const hasil = p.hasilPanen != null && p.hasilPanen !== "" ? `${Number(p.hasilPanen).toFixed(1)} KG` : "-";
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
                        {p.fotoGeotagUrl ? (
                          <a href={p.fotoGeotagUrl} target="_blank" className="inline-flex items-center gap-1.5 cursor-pointer">
                            <img src={p.fotoGeotagUrl} alt="geotag" className="h-8 w-8 rounded object-cover border border-emerald-200" />
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.geotagSource === "GPS" ? "bg-green-100 text-green-700" : p.geotagSource === "EXIF" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{p.geotagSource || "GPS"}</span>
                          </a>
                        ) : <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 border border-red-200">✗ Tanpa Geotag</span>}
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
                          <Link href={`/perkebunan/pohon/${p.id}/edit`} title="Edit Master">
                            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full cursor-pointer touch-manipulation" type="button"><Pencil className="h-3.5 w-3.5" /></Button>
                          </Link>
                          <Link href={`/perkebunan/pohon/${p.id}/lapangan`} title="Data Lapangan">
                            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full bg-emerald-50 hover:bg-emerald-100 cursor-pointer touch-manipulation" type="button"><ClipboardList className="h-3.5 w-3.5 text-emerald-700" /></Button>
                          </Link>
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
