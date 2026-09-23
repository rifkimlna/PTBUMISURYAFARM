export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrintButton } from "@/components/admin/print-button";
import { ExportCsvButton } from "./actions";
import Link from "next/link";

const BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

type Params = { bulan?: string; blok?: string; q?: string };

function qsPanen(p: Params) {
  const s = new URLSearchParams();
  s.set("bulan", p.bulan || "semua");
  if (p.blok) s.set("blok", p.blok);
  if (p.q) s.set("q", p.q);
  return `/perkebunan/panen?${s.toString()}`;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function LaporanPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const bulanRaw = (sp.bulan || "").trim();
  const bulan = bulanRaw === "" ? "semua" : bulanRaw;
  const blok = (sp.blok || "").trim();
  const q = (sp.q || "").trim();
  const isSemua = bulan === "semua";
  const bulanValid = /^\d{4}-\d{2}$/.test(bulan);

  // where IDENTIK dengan menu Panen (app/perkebunan/panen/page.tsx + app/api/panen/route.ts)
  const where: Record<string, unknown> = {};
  let bulanStart: Date | null = null;
  let bulanEnd: Date | null = null;
  if (!isSemua && bulanValid) {
    const [y, m] = bulan.split("-").map(Number);
    bulanStart = new Date(y, m - 1, 1);
    bulanEnd = new Date(y, m, 1);
    where.tanggalPanen = { gte: bulanStart, lt: bulanEnd };
  }
  if (blok) where.pohon = { lokasiBlok: blok };
  if (q) {
    where.OR = [
      { pohonId: { contains: q, mode: "insensitive" } },
      { catatan: { contains: q, mode: "insensitive" } },
    ];
  }

  // Bucket: bulan spesifik -> harian sebulan, "semua" -> 6 bulan kalender terakhir
  const buckets: string[] = [];
  const modeHarian = !isSemua && bulanValid && bulanStart !== null;
  if (!isSemua && bulanValid && bulanStart) {
    const y = bulanStart.getFullYear();
    const m = bulanStart.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) buckets.push(dayKey(new Date(y, m, d)));
  } else {
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push(monthKey(d));
    }
  }

  const [total, agg, blokOptions, panenRows, sakitRows] = await Promise.all([
    prisma.panen.count({ where }),
    prisma.panen.aggregate({ where, _sum: { jumlahKg: true } }),
    prisma.pohon.findMany({ select: { lokasiBlok: true }, distinct: ["lokasiBlok"], orderBy: { lokasiBlok: "asc" } }),
    prisma.panen.findMany({
      where,
      select: { jumlahKg: true, tanggalPanen: true, pohonId: true, pohon: { select: { lokasiBlok: true } } },
      orderBy: { tanggalPanen: "asc" },
      take: 5000,
    }),
    prisma.pohon.groupBy({
      by: ["lokasiBlok"],
      _count: { _all: true },
      where: { status: "SAKIT", ...(blok ? { lokasiBlok: blok } : {}) },
    }),
  ]);

  const totalKg = Number(agg._sum.jumlahKg ?? 0);

  // Agregat per bucket dari baris Panen yang SAMA dengan filter menu Panen
  const bucketMap = new Map<string, { key: string; kg: number; n: number }>();
  for (const k of buckets) bucketMap.set(k, { key: k, kg: 0, n: 0 });
  for (const r of panenRows) {
    const key = modeHarian ? dayKey(new Date(r.tanggalPanen)) : monthKey(new Date(r.tanggalPanen));
    const item = bucketMap.get(key);
    if (!item) continue;
    item.kg += Number(r.jumlahKg);
    item.n += 1;
  }
  const panenSeries = buckets.map((k) => bucketMap.get(k)!);
  const maxKg = Math.max(1, ...panenSeries.map((b) => b.kg));

  // Rekap per blok dari baris Panen yang SAMA (kg + catatan + pohon panen distinct)
  const blokMap = new Map<string, { blok: string; kg: number; n: number; pohonSet: Set<string> }>();
  for (const r of panenRows) {
    const b = r.pohon.lokasiBlok;
    let item = blokMap.get(b);
    if (!item) {
      item = { blok: b, kg: 0, n: 0, pohonSet: new Set() };
      blokMap.set(b, item);
    }
    item.kg += Number(r.jumlahKg);
    item.n += 1;
    item.pohonSet.add(r.pohonId);
  }
  const sakitMap = new Map(sakitRows.map((s) => [s.lokasiBlok, s._count._all]));
  const rekapBlok = [...blokMap.values()]
    .map((r) => ({ blok: r.blok, pohon: r.pohonSet.size, kg: r.kg, n: r.n, sakit: sakitMap.get(r.blok) ?? 0 }))
    .sort((a, b) => b.kg - a.kg);

  const filterDesc = [
    isSemua ? "semua bulan (6 bln terakhir)" : `${BULAN_LONG[Number(bulan.slice(5, 7)) - 1] || ""} ${bulan.slice(0, 4)}`,
    blok ? `Blok ${blok}` : "semua blok",
    q ? `cari "${q}"` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const csvSeries =
    modeHarian
      ? [["Tanggal", "Panen (KG)", "Catatan"], ...panenSeries.map((b) => [b.key, String(Math.round(b.kg * 10) / 10), String(b.n)])]
      : [
          ["Bulan", "Panen (KG)", "Catatan"],
          ...panenSeries.map((b) => {
            const d = new Date(b.key + "-01T00:00:00");
            return [`${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`, String(Math.round(b.kg * 10) / 10), String(b.n)];
          }),
        ];
  const csvBlok = [
    ["Blok", "Pohon panen", "Panen (KG)", "Catatan", "Sakit (saat ini)"],
    ...rekapBlok.map((r) => [r.blok, String(r.pohon), String(Math.round(r.kg * 10) / 10), String(r.n), String(r.sakit)]),
  ];

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-row items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-xl font-semibold tracking-tight text-slate-900 truncate">Laporan</h1>
          <p className="text-[11px] sm:text-sm text-slate-500 truncate">
            {total} catatan • {totalKg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} KG • {filterDesc}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400 hidden sm:block">Sama persis dengan filter menu Panen • kolom Sakit = kondisi pohon saat ini</p>
        </div>
        <div className="shrink-0 ml-auto">
          <PrintButton label="Cetak" />
        </div>
      </div>

      <form method="get" action="/perkebunan/laporan" className="flex flex-col sm:flex-row gap-2">
        <Input
          type="month"
          name="bulan"
          defaultValue={isSemua ? "" : bulan}
          className="h-11 rounded-full bg-white sm:max-w-[200px]"
        />
        <select name="blok" defaultValue={blok} className="h-11 rounded-full border border-slate-200 bg-white px-3 text-sm">
          <option value="">Semua blok</option>
          {blokOptions.map((b) => (
            <option key={b.lokasiBlok} value={b.lokasiBlok}>{b.lokasiBlok}</option>
          ))}
        </select>
        <Input name="q" defaultValue={q} placeholder="Cari ID / catatan" className="h-11 rounded-full bg-white flex-1" />
        <Button type="submit" className="h-11 rounded-full bg-slate-900 hover:bg-slate-800 px-5 shrink-0">Tampil</Button>
      </form>
      {!isSemua || blok || q ? (
        <div className="-mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Filter aktif: {filterDesc}</span>
          <Link href="/perkebunan/laporan" className="font-medium text-green-800 hover:underline">Reset →</Link>
          <Link href={qsPanen({ bulan, blok, q })} className="font-medium text-green-800 hover:underline">
            Lihat daftar di Panen →
          </Link>
        </div>
      ) : (
        <div className="-mt-2 text-xs">
          <Link href={qsPanen({ bulan, blok, q })} className="font-medium text-green-800 hover:underline">
            Lihat daftar di Panen →
          </Link>
        </div>
      )}

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">{modeHarian ? "Panen per hari" : "Panen per bulan"}</CardTitle>
          <ExportCsvButton filename={modeHarian ? "panen-harian.csv" : "panen-bulanan.csv"} rows={csvSeries} />
        </CardHeader>
        <CardContent className="space-y-3">
          {panenRows.length === 0 && <div className="text-sm text-slate-500">Belum ada data panen untuk filter ini.</div>}
          {panenSeries.map((b) => {
            const label = modeHarian
              ? new Date(b.key + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" })
              : (() => {
                  const d = new Date(b.key + "-01T00:00:00");
                  return `${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
                })();
            return (
              <div key={b.key} className="flex items-center gap-3">
                <div className="w-20 shrink-0 text-xs text-slate-500">{label}</div>
                <div className="h-8 flex-1 rounded-lg bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-lg bg-green-700" style={{ width: `${b.kg > 0 ? Math.max(2, Math.round((b.kg / maxKg) * 100)) : 0}%` }} />
                </div>
                <div className="w-28 shrink-0 text-right text-sm font-semibold text-slate-900">
                  {b.kg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} KG
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 pt-1">
            <Link href={qsPanen({ bulan, blok, q })} className="text-xs font-medium text-green-800 hover:underline">
              Kelola panen →
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">Rekap per blok</CardTitle>
          <ExportCsvButton filename="rekap-blok.csv" rows={csvBlok} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Blok</th>
                  <th className="px-4 py-2.5 font-medium text-right">Pohon panen</th>
                  <th className="px-4 py-2.5 font-medium text-right">Panen (KG)</th>
                  <th className="px-4 py-2.5 font-medium text-right">Catatan</th>
                  <th className="px-4 py-2.5 font-medium text-right">Sakit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rekapBlok.map((r) => (
                  <tr key={r.blok}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{r.blok}</td>
                    <td className="px-4 py-2.5 text-right">{r.pohon}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{r.kg.toLocaleString("id-ID", { maximumFractionDigits: 1 })}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{r.n}</td>
                    <td className={`px-4 py-2.5 text-right ${r.sakit > 0 ? "font-semibold text-red-600" : "text-slate-400"}`}>{r.sakit}</td>
                  </tr>
                ))}
                {rekapBlok.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Belum ada data untuk filter ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
