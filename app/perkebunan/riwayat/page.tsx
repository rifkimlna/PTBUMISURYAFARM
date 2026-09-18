export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { Search } from "lucide-react";

const PAGE_SIZE = 20;

export default async function RiwayatPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const where = q
    ? {
        OR: [
          { pohonId: { contains: q, mode: "insensitive" as const } },
          { petugas: { nama: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [total, data] = await Promise.all([
    prisma.riwayatKesehatan.count({ where }),
    prisma.riwayatKesehatan.findMany({
      where,
      orderBy: { tanggalCek: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { pohon: { select: { id: true, varietas: true } }, petugas: { select: { nama: true } } },
    }),
  ]);

  const totalPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, totalPage);
  const base = q ? `/perkebunan/riwayat?q=${encodeURIComponent(q)}&` : "/perkebunan/riwayat?";

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Riwayat</h1>
        <p className="text-xs sm:text-sm text-slate-500">{total} catatan</p>
      </div>

      <form method="get" action="/perkebunan/riwayat" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input name="q" defaultValue={q} placeholder="Cari ID pohon / nama petugas" className="pl-9 h-11 rounded-full bg-white" />
        </div>
        <Button type="submit" className="h-11 rounded-full bg-slate-900 hover:bg-slate-800 px-5 shrink-0">Cari</Button>
      </form>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm">Catatan terbaru</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pohon</TableHead>
                <TableHead>Gejala</TableHead>
                <TableHead>Petugas</TableHead>
                <TableHead>Foto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.tanggalCek).toLocaleDateString("id-ID")}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{r.pohon.id}</TableCell>
                  <TableCell className="text-sm max-w-[240px] truncate">{r.gejala}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.petugas.nama}</TableCell>
                  <TableCell>
                    {r.fotoUrl ? (
                      <a href={r.fotoUrl} target="_blank" className="text-xs text-green-800 hover:underline">
                        Lihat
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    Belum ada riwayat
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <div className="text-xs text-slate-500">Hal {cur}/{totalPage}</div>
            <div className="flex items-center gap-2">
              {cur > 1 ? (
                <Link href={`${base}page=${cur - 1}`}>
                  <Button variant="outline" size="sm" className="rounded-full">←</Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" className="rounded-full opacity-40" disabled>←</Button>
              )}
              {cur < totalPage ? (
                <Link href={`${base}page=${cur + 1}`}>
                  <Button variant="outline" size="sm" className="rounded-full">→</Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" className="rounded-full opacity-40" disabled>→</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
