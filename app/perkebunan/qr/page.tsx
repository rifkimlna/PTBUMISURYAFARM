import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/admin/print-button";
import { headers } from "next/headers";

export default async function QrPage() {
  const pohon = await prisma.pohon.findMany({ orderBy: { id: "asc" }, take: 12 });
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const base = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Cetak QR Massal</h1>
        <p className="text-sm text-slate-500">
          Scan QR membuka <code className="bg-slate-100 px-1 rounded">/pohon/[id]</code> • Base: <span className="font-mono text-xs">{base}</span>
        </p>
      </div>
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
                <img src={qr} alt={p.id} className="h-40 w-40 border rounded-lg p-2 bg-white" />
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
