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

export function PohonTable({ data }: { data: Pohon[] }) {
  const [qrId, setQrId] = useState<string | null>(null);
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="sticky left-0 bg-slate-50 text-xs font-medium text-slate-500 whitespace-nowrap">NO</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">ID</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">NAMA POHON</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">JENIS</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">RIWAYAT PENYAKIT</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">TANGGAL TANAM</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">BLOK</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">KOORDINAT</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">HASIL PANEN</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">USIA POHON</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">PEMUPUKAN</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">PENGOBATAN</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 whitespace-nowrap">STATUS</TableHead>
              <TableHead className="text-right text-xs font-medium text-slate-500 whitespace-nowrap sticky right-0 bg-slate-50">AKSI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-slate-500 py-8">
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
                    <TableCell className="sticky left-0 bg-white text-xs font-medium text-slate-600">{no}</TableCell>
                    <TableCell className="font-mono text-xs font-medium tracking-tight whitespace-nowrap">{p.id}</TableCell>
                    <TableCell className="text-sm text-slate-700 whitespace-nowrap max-w-[160px] truncate" title={p.namaPohon || p.varietas}>
                      {p.namaPohon || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700 whitespace-nowrap">{p.jenis || p.varietas || "-"}</TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{riwayatCount} riwayat</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">{tgl}</TableCell>
                    <TableCell className="text-sm text-slate-500 whitespace-nowrap">{p.lokasiBlok}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {p.koordinat ? (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(p.koordinat)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:underline"
                          title={p.koordinat}
                        >
                          <MapPin className="h-3 w-3" />
                          {koordinat}
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-700 whitespace-nowrap">{hasil}</TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">{usia}</TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[180px] truncate whitespace-nowrap" title={p.pemupukan || ""}>
                      {p.pemupukan ? <span className="truncate">{p.pemupukan}</span> : <span className="text-slate-400">-</span>}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[180px] truncate whitespace-nowrap" title={p.pengobatan || ""}>
                      {p.pengobatan ? <span className="truncate">{p.pengobatan}</span> : <span className="text-slate-400">-</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge s={p.status} />
                    </TableCell>
                    <TableCell className="text-right sticky right-0 bg-white">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-full px-3 text-xs cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setQrId(p.id);
                          }}
                        >
                          <QrCode className="h-3 w-3" /> QR
                        </Button>
                        <Link href={`/pohon/${p.id}`} target="_blank">
                          <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full" type="button">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </Link>
                        <Link href={`/admin/pertanian/pohon/${p.id}/edit`} title="Edit Master">
                          <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full" type="button">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </Link>
                        <Link href={`/admin/pertanian/pohon/${p.id}/lapangan`} title="Data Lapangan">
                          <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full bg-emerald-50 hover:bg-emerald-100" type="button">
                            <ClipboardList className="h-3 w-3 text-emerald-700" />
                          </Button>
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
      <QrModal open={!!qrId} onOpenChange={(o) => !o && setQrId(null)} pohonId={qrId || ""} />
    </>
  );
}
