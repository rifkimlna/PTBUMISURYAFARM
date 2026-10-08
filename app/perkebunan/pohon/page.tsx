export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import { StatusKesehatan } from "../../../generated/prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PohonTable } from "@/components/admin/pohon-table";
import { PohonFilter } from "@/components/admin/pohon-filter";
import { DbErrorBanner } from "@/components/admin/db-error-banner";
import Link from "next/link";
import { Plus, ArrowLeft, X } from "lucide-react";

const PAGE_SIZE = 12;
const STATUS_LIST = ["SEHAT", "PERLU_PERHATIAN", "SAKIT", "MATI"];

type Params = { q?: string; blok?: string; status?: string; ukuran?: string; hasGeotag?: string; page?: string };

function qs(p: Omit<Params, "page"> & { page?: string | number }) {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.blok) s.set("blok", p.blok);
  if (p.status) s.set("status", p.status);
  if (p.ukuran) s.set("ukuran", p.ukuran);
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
  const ukuran = (sp.ukuran || "").trim().toUpperCase();
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
  if (ukuran === "KECIL") and.push({ tinggiCm: { lt: 150 } });
  else if (ukuran === "SEDANG") and.push({ tinggiCm: { gte: 150, lte: 400 } });
  else if (ukuran === "BESAR") and.push({ tinggiCm: { gt: 400 } });
  else if (ukuran === "BELUM_UKUR") and.push({ tinggiCm: null });
  const where: Prisma.PohonWhereInput = and.length > 0 ? { AND: and } : {};

  let total = 0;
  let pohon: any[] = [];
  let blokRows: { lokasiBlok: string }[] = [];
  let dbError = false;
  try {
    [total, pohon, blokRows] = await Promise.all([
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
  } catch (e) {
    console.error("[perkebunan/pohon] database tidak terjangkau:", e instanceof Error ? e.message : e);
    dbError = true;
  }

  const totalPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, totalPage);
  const from = total === 0 ? 0 : (cur - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, cur * PAGE_SIZE);

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Link href="/perkebunan" className="shrink-0">
            <Button variant="ghost" size="icon" className="rounded-full cursor-pointer h-8 w-8 sm:h-10 sm:w-10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-semibold tracking-tight text-slate-900 truncate">Data Pohon</h1>
            <p className="text-[11px] sm:text-sm text-slate-500">{total} pohon</p>
          </div>
        </div>
        <Link href="/perkebunan/pohon/tambah" className="shrink-0 ml-auto">
          <Button size="sm" className="rounded-full bg-green-700 hover:bg-green-800 h-9 px-3.5 text-xs sm:h-10 sm:px-4 sm:text-sm cursor-pointer shadow-sm">
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        </Link>
      </div>

      {dbError && <DbErrorBanner />}

      <PohonFilter
        q={q}
        blok={blok}
        status={status}
        ukuran={ukuran}
        blokRows={blokRows.map((b) => b.lokasiBlok)}
        statusList={STATUS_LIST}
      />

      {(q || blok || status || ukuran || hasGeotag) && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs -mt-1 sm:-mt-2">
          {q && (
            <Link href={qs({ blok, status, ukuran, hasGeotag })} className="inline-flex items-center gap-1 rounded-full bg-slate-900 pl-3 pr-2 py-1 font-medium text-white">
              “{q}” <X className="h-3 w-3" />
            </Link>
          )}
          {blok && (
            <Link href={qs({ q, status, ukuran, hasGeotag })} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 pl-3 pr-2 py-1 font-medium text-emerald-800">
              {blok} <X className="h-3 w-3" />
            </Link>
          )}
          {status && (
            <Link href={qs({ q, blok, ukuran, hasGeotag })} className="inline-flex items-center gap-1 rounded-full bg-blue-100 pl-3 pr-2 py-1 font-medium text-blue-800">
              {status.replace("_", " ")} <X className="h-3 w-3" />
            </Link>
          )}
          {ukuran && (
            <Link href={qs({ q, blok, status, hasGeotag })} className="inline-flex items-center gap-1 rounded-full bg-purple-100 pl-3 pr-2 py-1 font-medium text-purple-800">
              {ukuran} <X className="h-3 w-3" />
            </Link>
          )}
          {hasGeotag && (
            <Link href={qs({ q, blok, status, ukuran })} className="inline-flex items-center gap-1 rounded-full bg-amber-100 pl-3 pr-2 py-1 font-medium text-amber-800">
              {hasGeotag === "false" ? "belum ada foto" : "ada foto"} <X className="h-3 w-3" />
            </Link>
          )}
          <Link href="/perkebunan/pohon" className="text-slate-500 hover:underline px-1">Reset</Link>
        </div>
      )}

      <Card className="overflow-hidden border-slate-100">
        <PohonTable
          data={pohon.map((p: any) => ({
            id: p.id,
            namaPohon: p.namaPohon,
            varietas: p.varietas,
            lokasiBlok: p.lokasiBlok,
            tanggalTanam: p.tanggalTanam.toISOString(),
            koordinat: p.koordinat,
            hasilPanen: p.hasilPanen != null ? p.hasilPanen.toString() : null,
            pemupukan: p.pemupukan,
            pengobatan: p.pengobatan,
            tinggiCm: p.tinggiCm ?? null,
            lingkarBatangCm: p.lingkarBatangCm != null ? p.lingkarBatangCm.toString() : null,
            phTanah: p.phTanah != null ? p.phTanah.toString() : null,
            diukurPada: p.diukurPada?.toISOString?.() ?? null,
            status: p.status as string,
            fotoGeotagUrl: p.fotoGeotagUrl,
            latitude: p.latitude,
            longitude: p.longitude,
            geotagSource: p.geotagSource,
            geotagTimestamp: p.geotagTimestamp?.toISOString?.() ?? null,
            _count: p._count,
          }))}
        />
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 border-t border-slate-100 bg-white/95 px-4 py-2.5 backdrop-blur">
          <div className="text-xs text-slate-500">{total === 0 ? "Tidak ada data" : `${from}–${to} dari ${total}`}</div>
          <div className="flex items-center gap-1.5">
            {cur > 1 ? (
              <Link href={qs({ q, blok, status, ukuran, hasGeotag, page: cur - 1 })}>
                <Button variant="outline" size="sm" className="rounded-full h-9 w-9 p-0 cursor-pointer">←</Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" className="rounded-full h-9 w-9 p-0 opacity-40" disabled>←</Button>
            )}
            <span className="min-w-10 text-center text-xs font-medium text-slate-600">{cur}/{totalPage}</span>
            {cur < totalPage ? (
              <Link href={qs({ q, blok, status, ukuran, hasGeotag, page: cur + 1 })}>
                <Button variant="outline" size="sm" className="rounded-full h-9 w-9 p-0 cursor-pointer">→</Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" className="rounded-full h-9 w-9 p-0 opacity-40" disabled>→</Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
