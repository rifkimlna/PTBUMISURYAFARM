export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import { StatusKesehatan } from "../../../generated/prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PohonTable } from "@/components/admin/pohon-table";
import Link from "next/link";
import { Plus, ArrowLeft, Search } from "lucide-react";

const PAGE_SIZE = 12;
const STATUS_LIST = ["SEHAT", "PERLU_PERHATIAN", "SAKIT", "MATI"];

type Params = { q?: string; blok?: string; status?: string; hasGeotag?: string; page?: string };

function qs(p: Omit<Params, "page"> & { page?: string | number }) {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.blok) s.set("blok", p.blok);
  if (p.status) s.set("status", p.status);
  if (p.hasGeotag) s.set("hasGeotag", p.hasGeotag);
  if (p.page && Number(p.page) > 1) s.set("page", String(p.page));
  const str = s.toString();
  return str ? `/perkebunan/pohon?${str}` : "/perkebunan/pohon";
}

export default async function DataPohonPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const blok = (sp.blok || "").trim();
  const status = (sp.status || "").trim();
  const hasGeotag = (sp.hasGeotag || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const and: Prisma.PohonWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { namaPohon: { contains: q, mode: "insensitive" } },
        { varietas: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (blok) and.push({ lokasiBlok: blok });
  if (status && (Object.values(StatusKesehatan) as string[]).includes(status)) {
    and.push({ status: status as StatusKesehatan });
  }
  if (hasGeotag === "false") {
    and.push({ OR: [{ fotoGeotagUrl: null }, { fotoGeotagUrl: { contains: "storage.pt-bst.example" } }] });
  } else if (hasGeotag === "true") {
    and.push({ fotoGeotagUrl: { not: null } });
  }
  const where: Prisma.PohonWhereInput = and.length > 0 ? { AND: and } : {};

  const [total, pohon, blokRows] = await Promise.all([
    prisma.pohon.count({ where }),
    prisma.pohon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { riwayat: true } } },
    }),
    prisma.pohon.findMany({ select: { lokasiBlok: true }, distinct: ["lokasiBlok"], orderBy: { lokasiBlok: "asc" } }),
  ]);

  const totalPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, totalPage);
  const from = total === 0 ? 0 : (cur - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, cur * PAGE_SIZE);

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/perkebunan" className="shrink-0">
            <Button variant="ghost" size="icon" className="rounded-full cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Data Pohon</h1>
            <p className="text-xs sm:text-sm text-slate-500">{total} pohon</p>
          </div>
        </div>
        <Link href="/perkebunan/pohon/tambah" className="shrink-0">
          <Button className="rounded-full bg-green-700 hover:bg-green-800 w-full sm:w-auto cursor-pointer">
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        </Link>
      </div>

      <form method="get" action="/perkebunan/pohon" className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input name="q" defaultValue={q} placeholder="Cari ID / nama / varietas" className="pl-9 h-11 rounded-full bg-white" />
        </div>
        <div className="flex gap-2">
          <select name="blok" defaultValue={blok} className="h-11 rounded-full border border-slate-200 bg-white px-3 text-sm flex-1 sm:flex-none">
            <option value="">Semua blok</option>
            {blokRows.map((b) => (
              <option key={b.lokasiBlok} value={b.lokasiBlok}>{b.lokasiBlok}</option>
            ))}
          </select>
          <select name="status" defaultValue={status} className="h-11 rounded-full border border-slate-200 bg-white px-3 text-sm flex-1 sm:flex-none">
            <option value="">Semua status</option>
            {STATUS_LIST.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
          <Button type="submit" className="h-11 rounded-full bg-slate-900 hover:bg-slate-800 px-5 shrink-0">Cari</Button>
        </div>
      </form>

      {hasGeotag && (
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
            Filter: {hasGeotag === "false" ? "belum ada foto" : "ada foto"}
          </span>
          <Link href="/perkebunan/pohon" className="text-slate-500 hover:underline">Reset</Link>
        </div>
      )}

      <Card className="overflow-hidden border-slate-100">
        <PohonTable
          data={pohon.map((p) => ({
            id: p.id,
            namaPohon: p.namaPohon,
            varietas: p.varietas,
            jenis: p.jenis,
            lokasiBlok: p.lokasiBlok,
            tanggalTanam: p.tanggalTanam.toISOString(),
            koordinat: p.koordinat,
            hasilPanen: p.hasilPanen != null ? p.hasilPanen.toString() : null,
            pemupukan: p.pemupukan,
            pengobatan: p.pengobatan,
            status: p.status as string,
            fotoGeotagUrl: p.fotoGeotagUrl,
            latitude: p.latitude,
            longitude: p.longitude,
            geotagSource: p.geotagSource,
            geotagTimestamp: p.geotagTimestamp?.toISOString?.() ?? null,
            _count: p._count,
          }))}
        />
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <div className="text-xs text-slate-500">{total === 0 ? "Tidak ada data" : `${from}–${to} dari ${total}`}</div>
          <div className="flex items-center gap-2">
            {cur > 1 ? (
              <Link href={qs({ q, blok, status, hasGeotag, page: cur - 1 })}>
                <Button variant="outline" size="sm" className="rounded-full">←</Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" className="rounded-full opacity-40" disabled>←</Button>
            )}
            <span className="text-xs text-slate-500">{cur}/{totalPage}</span>
            {cur < totalPage ? (
              <Link href={qs({ q, blok, status, hasGeotag, page: cur + 1 })}>
                <Button variant="outline" size="sm" className="rounded-full">→</Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" className="rounded-full opacity-40" disabled>→</Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
