export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TambahBlokForm, BlokRowActions } from "./actions";

export default async function BlokPage() {
  const bloks = await prisma.blok.findMany({ orderBy: { kode: "asc" } });
  const counts = await prisma.pohon.groupBy({ by: ["lokasiBlok"], _count: { _all: true } });
  const map = new Map(counts.map((c) => [c.lokasiBlok, c._count._all]));

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Blok</h1>
        <p className="text-xs sm:text-sm text-slate-500">{bloks.length} blok • 120 Ha</p>
      </div>

      <TambahBlokForm />

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm">Daftar blok</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {bloks.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
                  {b.kode}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 truncate">{b.nama}</div>
                  <div className="text-xs text-slate-500">
                    {map.get(b.nama) ?? 0} pohon{b.luasHa != null ? ` • ${b.luasHa} Ha` : ""}
                  </div>
                </div>
                <BlokRowActions id={b.id} nama={b.nama} luasHa={b.luasHa} jumlahPohon={map.get(b.nama) ?? 0} />
              </div>
            ))}
            {bloks.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Belum ada blok</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
