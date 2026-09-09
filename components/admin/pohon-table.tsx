"use client";
import { useState } from "react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QrCode, Eye, Pencil } from "lucide-react";
import { QrModal } from "./qr-modal";
import Link from "next/link";

type Pohon = { id: string; varietas: string; lokasiBlok: string; status: string; tanggalTanam: string };

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, any> = { SEHAT: "sehat", PERLU_PERHATIAN: "perhatian", SAKIT: "sakit", MATI: "mati" };
  return <Badge variant={map[s] || "secondary"}>{s.replace("_", " ")}</Badge>;
}

export function PohonTable({ data }: { data: Pohon[] }) {
  const [qrId, setQrId] = useState<string | null>(null);
  return (
    <>
      <div className="overflow-x-auto">
        <Table>
        <TableHeader>
          <TableRow className="border-slate-50 hover:bg-transparent">
            <TableHead className="text-xs tracking-wide font-medium text-slate-400">ID</TableHead>
            <TableHead className="text-xs tracking-wide font-medium text-slate-400">Varietas</TableHead>
            <TableHead className="text-xs tracking-wide font-medium text-slate-400">Blok</TableHead>
            <TableHead className="text-xs tracking-wide font-medium text-slate-400">Status</TableHead>
            <TableHead className="text-right text-xs tracking-wide font-medium text-slate-400">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                Belum ada data pohon
              </TableCell>
            </TableRow>
          ) : (
            data.map((p) => (
              <TableRow key={p.id} className="border-slate-50 hover:bg-slate-50/50">
                <TableCell className="font-mono text-xs font-medium tracking-tight">{p.id}</TableCell>
                <TableCell className="text-sm text-slate-700">{p.varietas}</TableCell>
                <TableCell className="text-sm text-slate-500">{p.lokasiBlok}</TableCell>
                <TableCell>
                  <StatusBadge s={p.status} />
                </TableCell>
                <TableCell className="text-right">
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
                    <Link href={`/admin/pertanian/scan?id=${p.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full" type="button">
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
      <QrModal open={!!qrId} onOpenChange={(o) => !o && setQrId(null)} pohonId={qrId || ""} />
    </>
  );
}
