export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { TambahPanenForm, HapusPanenButton } from "./actions";

const PAGE_SIZE = 20;

type Params = { bulan?: string; blok?: string; q?: string; page?: string };

function qs(p: Omit<Params, "page"> & { page?: string | number }) {
  const s = new URLSearchParams();
  if (p.bulan) s.set("bulan", p.bulan);
  if (p.blok) s.set("blok", p.blok);
  if (p.q) s.set("q", p.q);
  if (p.page && Number(p.page) > 1) s.set("page", String(p.page));
  const str = s.toString();
  return str ? `/perkebunan/panen?${str}` : "/perkebunan/panen";
}

export default async function PanenPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const now = new Date();
  const defaultBulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const bulan = (sp.bulan || defaultBulan).trim();
  const blok = (sp.blok || "").trim();
  const q = (sp.q || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Record<string, unknown> = {};
  if (bulan && bulan !== "semua" && /^\d{4}-\d{2}$/.test(bulan)) {
    const [y, m] = bulan.split("-").map(Number);
    where.tanggalPanen = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (blok) where.pohon = { lokasiBlok: blok };
  if (q) {
    where.OR = [
      { pohonId: { contains: q, mode: "insensitive" } },
      { catatan: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows, agg, blokRows] = await Promise.all([
    prisma.panen.count({ where }),
    prisma.panen.findMany({
      where,
      orderBy: { tanggalPanen: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        pohon: { select: { id: true, lokasiBlok: true } },
        petugas: { select: { nama: true } },
      },
    }),
    prisma.panen.aggregate({ where, _sum: { jumlahKg: true } }),
    prisma.pohon.findMany({ select: { lokasiBlok: true }, distinct: ["lokasiBlok"], orderBy: { lokasiBlok: "asc" } }),
  ]);

  const totalPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, totalPage);
  const totalKg = Number(agg._sum.jumlahKg ?? 0);

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-xl font-semibold tracking-tight text-slate-900 truncate">Panen</h1>
          <p className="text-[11px] sm:text-sm text-slate-500 truncate">{total} catatan • {totalKg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} KG</p>
        </div>
        <div className="shrink-0 ml-auto">
          <TambahPanenForm />
        </div>
      </div>

      <form method="get" action="/perkebunan/panen" className="flex flex-col sm:flex-row gap-2">
        <Input type="month" name="bulan" defaultValue={bulan === "semua" ? "" : bulan} className="h-11 rounded-full bg-white sm:max-w-[200px]" />
        <select name="blok" defaultValue={blok} className="h-11 rounded-full border border-slate-200 bg-white px-3 text-sm">
          <option value="">Semua blok</option>
          {blokRows.map((b) => (
            <option key={b.lokasiBlok} value={b.lokasiBlok}>{b.lokasiBlok}</option>
          ))}
        </select>
        <Input name="q" defaultValue={q} placeholder="Cari ID / catatan" className="h-11 rounded-full bg-white flex-1" />
        <Button type="submit" className="h-11 rounded-full bg-slate-900 hover:bg-slate-800 px-5 shrink-0">Tampil</Button>
      </form>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm">Catatan panen</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pohon</TableHead>
                <TableHead>Blok</TableHead>
                <TableHead>KG</TableHead>
                <TableHead>Petugas</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.tanggalPanen).toLocaleDateString("id-ID")}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{r.pohonId}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.pohon.lokasiBlok}</TableCell>
                  <TableCell className="text-sm font-semibold whitespace-nowrap">{Number(r.jumlahKg).toLocaleString("id-ID")} KG</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.petugas?.nama || "-"}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{r.catatan || "-"}</TableCell>
                  <TableCell className="text-right">
                    <HapusPanenButton id={r.id} />
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Belum ada catatan
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
                <Link href={qs({ bulan, blok, q, page: cur - 1 })}>
                  <Button variant="outline" size="sm" className="rounded-full">←</Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" className="rounded-full opacity-40" disabled>←</Button>
              )}
              {cur < totalPage ? (
                <Link href={qs({ bulan, blok, q, page: cur + 1 })}>
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
