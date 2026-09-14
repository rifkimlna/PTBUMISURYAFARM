import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/admin/print-button";
import { headers } from "next/headers";

export default async function QrPage({ searchParams }: { searchParams: Promise<{ blok?: string }> }) {
  const sp = await searchParams;
  const blok = (sp.blok || "").trim();
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const base = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  const [total, blokRows] = await Promise.all([
    prisma.pohon.count({ where: blok ? { lokasiBlok: blok } : {} }),
    prisma.pohon.findMany({ select: { lokasiBlok: true }, distinct: ["lokasiBlok"], orderBy: { lokasiBlok: "asc" } }),
  ]);
  const pohon = await prisma.pohon.findMany({
    where: blok ? { lokasiBlok: blok } : {},
    orderBy: { id: "asc" },
    take: blok ? undefined : 50,
  });

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Cetak QR</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Tempel di batang pohon • Scan membuka halaman pohon
        </p>
      </div>

      <form method="get" action="/perkebunan/qr" className="flex gap-2">
        <select name="blok" defaultValue={blok} className="h-11 rounded-full border border-slate-200 bg-white px-3 text-sm flex-1 sm:flex-none sm:min-w-[200px]">
          <option value="">Pilih blok…</option>
          {blokRows.map((b) => (
            <option key={b.lokasiBlok} value={b.lokasiBlok}>{b.lokasiBlok}</option>
          ))}
        </select>
        <Button type="submit" className="h-11 rounded-full bg-slate-900 hover:bg-slate-800 px-5 shrink-0">Tampil</Button>
        {blok && (
          <a href="/perkebunan/qr" className="shrink-0">
            <Button type="button" variant="outline" className="h-11 rounded-full">Reset</Button>
          </a>
        )}
      </form>

      <p className="text-xs text-slate-500">
        {blok ? `${total} pohon di ${blok}` : `Menampilkan ${pohon.length} dari ${total} pohon — pilih blok untuk tampil semua`}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pohon.map((p) => {
          const url = `${base}/pohon/${p.id}`;
          const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
          return (
            <Card key={p.id} className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono">{p.id}</CardTitle>
                <div className="text-[11px] text-slate-400 break-all">{url}</div>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                <img src={qr} alt={p.id} className="h-40 w-40 border rounded-lg p-2 bg-white" loading="lazy" />
                <div className="text-xs text-slate-500">{p.varietas} • {p.lokasiBlok}</div>
                <PrintButton label="Cetak" />
              </CardContent>
            </Card>
          );
        })}
      </div>
      {pohon.length === 0 && <div className="text-sm text-slate-500">Belum ada pohon.</div>}
    </div>
  );
}
