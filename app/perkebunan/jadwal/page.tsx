import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { TambahJadwalForm, JadwalRowActions } from "./actions";

const PAGE_SIZE = 20;
const STATUS_LIST = ["RENCANA", "SELESAI", "BATAL"];

type Params = { status?: string; blok?: string; page?: string };

function qs(p: Omit<Params, "page"> & { page?: string | number }) {
  const s = new URLSearchParams();
  if (p.status) s.set("status", p.status);
  if (p.blok) s.set("blok", p.blok);
  if (p.page && Number(p.page) > 1) s.set("page", String(p.page));
  const str = s.toString();
  return str ? `/perkebunan/jadwal?${str}` : "/perkebunan/jadwal";
}

function jenisLabel(j: string) {
  return j === "PUPUK" ? "Pupuk" : j === "OBAT" ? "Obat" : "Lain";
}

export default async function JadwalPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const status = (sp.status || "RENCANA").trim();
  const blok = (sp.blok || "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Record<string, unknown> = {};
  if (status && status !== "semua") where.status = status;
  if (blok) where.blok = blok;

  const [total, rows, blokRows] = await Promise.all([
    prisma.jadwalPerawatan.count({ where }),
    prisma.jadwalPerawatan.findMany({
      where,
      orderBy: [{ tanggalRencana: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        pohon: { select: { id: true, namaPohon: true } },
        createdBy: { select: { nama: true } },
      },
    }),
    prisma.blok.findMany({ orderBy: { kode: "asc" } }),
  ]);

  const totalPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, totalPage);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Jadwal Perawatan</h1>
        <p className="text-xs sm:text-sm text-slate-500">{total} jadwal</p>
      </div>

      <TambahJadwalForm bloks={blokRows.map((b) => b.nama)} />

      <form method="get" action="/perkebunan/jadwal" className="flex gap-2">
        <select name="status" defaultValue={status} className="h-11 rounded-full border border-slate-200 bg-white px-3 text-sm flex-1 sm:flex-none">
          <option value="semua">Semua status</option>
          {STATUS_LIST.map((s) => (
            <option key={s} value={s}>{s === "RENCANA" ? "Rencana" : s === "SELESAI" ? "Selesai" : "Batal"}</option>
          ))}
        </select>
        <select name="blok" defaultValue={blok} className="h-11 rounded-full border border-slate-200 bg-white px-3 text-sm flex-1 sm:flex-none">
          <option value="">Semua blok</option>
          {blokRows.map((b) => (
            <option key={b.id} value={b.nama}>{b.nama}</option>
          ))}
        </select>
        <Button type="submit" className="h-11 rounded-full bg-slate-900 hover:bg-slate-800 px-5 shrink-0">Tampil</Button>
      </form>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm">Daftar jadwal</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {rows.map((r) => {
              const tgl = new Date(r.tanggalRencana);
              const overdue = r.status === "RENCANA" && tgl < today;
              return (
                <div key={r.id} className={`flex items-start gap-3 px-4 py-3 ${overdue ? "bg-red-50/50" : ""}`}>
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${r.jenis === "PUPUK" ? "bg-green-700" : r.jenis === "OBAT" ? "bg-amber-600" : "bg-slate-500"}`}>
                    {r.jenis.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {jenisLabel(r.jenis)} • {r.blok}
                      {r.pohonId ? <span className="font-mono text-xs text-slate-500"> • {r.pohonId}</span> : null}
                    </div>
                    <div className="text-xs text-slate-500">
                      {tgl.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                      {overdue ? <span className="ml-1.5 font-medium text-red-600">Terlewat</span> : null}
                      {r.status !== "RENCANA" ? <span className="ml-1.5">{r.status === "SELESAI" ? "• Selesai" : "• Batal"}</span> : null}
                      {r.catatan ? <span className="block truncate">{r.catatan}</span> : null}
                    </div>
                  </div>
                  <JadwalRowActions id={r.id} status={r.status} />
                </div>
              );
            })}
            {rows.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Belum ada jadwal</div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <div className="text-xs text-slate-500">Hal {cur}/{totalPage}</div>
            <div className="flex items-center gap-2">
              {cur > 1 ? (
                <Link href={qs({ status, blok, page: cur - 1 })}>
                  <Button variant="outline" size="sm" className="rounded-full">←</Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" className="rounded-full opacity-40" disabled>←</Button>
              )}
              {cur < totalPage ? (
                <Link href={qs({ status, blok, page: cur + 1 })}>
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
