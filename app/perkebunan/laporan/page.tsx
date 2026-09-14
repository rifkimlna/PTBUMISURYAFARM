export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/admin/print-button";
import { ExportCsvButton } from "./actions";
import Link from "next/link";

const BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default async function LaporanPage() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

  const panenBulanan = await prisma.$queryRaw<{ bulan: Date; kg: number; n: number }[]>`
    SELECT date_trunc('month', "tanggalPanen") AS bulan,
           COALESCE(SUM("jumlahKg"), 0)::float AS kg,
           COUNT(*)::int AS n
    FROM panen
    WHERE "tanggalPanen" >= ${sixMonthsAgo}
    GROUP BY 1 ORDER BY 1`;

  const rekapBlok = await prisma.$queryRaw<{ blok: string; pohon: number; kg: number; sakit: number }[]>`
    SELECT p."lokasiBlok" AS blok,
           COUNT(DISTINCT p.id)::int AS pohon,
           COALESCE(SUM(pn."jumlahKg"), 0)::float AS kg,
           COUNT(DISTINCT CASE WHEN p.status = 'SAKIT' THEN p.id END)::int AS sakit
    FROM pohon p LEFT JOIN panen pn ON pn."pohonId" = p.id
    GROUP BY 1 ORDER BY 1`;

  const maxKg = Math.max(1, ...panenBulanan.map((b) => b.kg));

  const csvBulanan = [["Bulan", "Panen (KG)", "Catatan"],
    ...panenBulanan.map((b) => {
      const d = new Date(b.bulan);
      return [`${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`, String(b.kg), String(b.n)];
    }),
  ];
  const csvBlok = [["Blok", "Pohon", "Panen (KG)", "Sakit"],
    ...rekapBlok.map((r) => [r.blok, String(r.pohon), String(r.kg), String(r.sakit)]),
  ];

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Laporan</h1>
          <p className="text-xs sm:text-sm text-slate-500">Rekap panen & blok • 6 bulan terakhir</p>
        </div>
        <PrintButton label="Cetak" />
      </div>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">Panen per bulan</CardTitle>
          <ExportCsvButton filename="panen-bulanan.csv" rows={csvBulanan} />
        </CardHeader>
        <CardContent className="space-y-3">
          {panenBulanan.length === 0 && <div className="text-sm text-slate-500">Belum ada data panen.</div>}
          {panenBulanan.map((b) => {
            const d = new Date(b.bulan);
            return (
              <div key={d.toISOString()} className="flex items-center gap-3">
                <div className="w-20 shrink-0 text-xs text-slate-500">{BULAN_ID[d.getMonth()]} {d.getFullYear()}</div>
                <div className="h-8 flex-1 rounded-lg bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-lg bg-green-700" style={{ width: `${Math.max(2, Math.round((b.kg / maxKg) * 100))}%` }} />
                </div>
                <div className="w-24 shrink-0 text-right text-sm font-semibold text-slate-900">{b.kg.toLocaleString("id-ID")} KG</div>
              </div>
            );
          })}
          <div className="flex gap-2 pt-1">
            <Link href="/perkebunan/panen" className="text-xs font-medium text-green-800 hover:underline">Kelola panen →</Link>
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
                  <th className="px-4 py-2.5 font-medium text-right">Pohon</th>
                  <th className="px-4 py-2.5 font-medium text-right">Panen (KG)</th>
                  <th className="px-4 py-2.5 font-medium text-right">Sakit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rekapBlok.map((r) => (
                  <tr key={r.blok}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{r.blok}</td>
                    <td className="px-4 py-2.5 text-right">{r.pohon}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{r.kg.toLocaleString("id-ID")}</td>
                    <td className={`px-4 py-2.5 text-right ${r.sakit > 0 ? "font-semibold text-red-600" : "text-slate-400"}`}>{r.sakit}</td>
                  </tr>
                ))}
                {rekapBlok.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Belum ada data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
