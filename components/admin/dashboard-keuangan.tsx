"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupiah } from "@/lib/utils";

// Dashboard Keuangan PT BST — tiap section membaca API ringkasannya sendiri
// dengan filter periode inline (dropdown langsung di section, tanpa popup).
// Filter satu section tidak memengaruhi section lain.

const PERIODE_DASAR = [
  { value: "hari-ini", label: "Hari ini" },
  { value: "pekan-ini", label: "Pekan ini" },
  { value: "bulan-ini", label: "Bulan ini" },
  { value: "kuartal-ini", label: "Kuartal ini" },
  { value: "tahun-ini", label: "Tahun ini" },
];

const PERIODE_PRODUK = [
  ...PERIODE_DASAR,
  { value: "kemarin", label: "Kemarin" },
  { value: "pekan-lalu", label: "Pekan Lalu" },
  { value: "bulan-lalu", label: "Bulan lalu" },
  { value: "kuartal-lalu", label: "Kuartal lalu" },
  { value: "tahun-lalu", label: "Tahun lalu" },
  { value: "custom", label: "Custom" },
];

function todayYMD() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function useSection<T>(section: string, periode: string, extra = "") {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/keuangan/dashboard?section=${section}&periode=${periode}${extra}`, { credentials: "include" })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result?.success) setData(result.data as T);
        else setError(result?.message || "Gagal memuat data");
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, periode, extra]);
  return { data, loading, error };
}

function SectionShell({
  title,
  desc,
  filter,
  children,
}: {
  title: string;
  desc: string;
  filter: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-col gap-3 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          <p className="mt-1 text-xs text-slate-500">{desc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{filter}</div>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function StateMsg({ loading, error, empty, emptyText }: { loading: boolean; error: string; empty?: boolean; emptyText?: string }) {
  if (loading) return <p className="py-6 text-center text-sm text-slate-400">Memuat data...</p>;
  if (error) return <p className="py-6 text-center text-sm text-red-600">{error}</p>;
  if (empty) return <p className="py-6 text-center text-sm text-slate-400">{emptyText ?? "Belum ada data"}</p>;
  return null;
}

// Tabel dengan paginasi 5 baris per halaman (Prev/Next di bawah tabel).
function PagedTable<T>({
  head,
  rows,
  renderRow,
  emptyText,
}: {
  head: React.ReactNode;
  rows: T[];
  renderRow: (row: T, i: number) => React.ReactNode;
  emptyText?: string;
}) {
  const pageSize = 5;
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [rows.length]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(page, totalPages - 1);
  const slice = rows.slice(safe * pageSize, safe * pageSize + pageSize);
  const from = rows.length === 0 ? 0 : safe * pageSize + 1;
  const to = Math.min(rows.length, safe * pageSize + pageSize);
  const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="bg-slate-50">{head}</TableRow></TableHeader>
          <TableBody>
            {slice.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-slate-400">
                  {emptyText ?? "Belum ada data"}
                </TableCell>
              </TableRow>
            ) : (
              slice.map((r, i) => renderRow(r, safe * pageSize + i))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2.5">
        <span className="text-xs text-slate-400">
          {from}–{to} dari {rows.length}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" className={btn} disabled={safe === 0} onClick={() => setPage(safe - 1)}>
            ← Sebelumnya
          </button>
          <span className="text-xs text-slate-500">
            {safe + 1}/{totalPages}
          </span>
          <button type="button" className={btn} disabled={safe >= totalPages - 1} onClick={() => setPage(safe + 1)}>
            Berikutnya →
          </button>
        </div>
      </div>
    </div>
  );
}

function PeriodeSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options?: { value: string; label: string }[] }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-auto text-xs" aria-label="Filter periode">
      {(options ?? PERIODE_DASAR).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

function ViewToggle({ view, onChange }: { view: "grafik" | "tabel"; onChange: (v: "grafik" | "tabel") => void }) {
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-medium">
      {(["grafik", "tabel"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1 capitalize transition-colors ${view === v ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
        >
          {v === "grafik" ? "Grafik" : "Tabel"}
        </button>
      ))}
    </div>
  );
}

// ---------- Grafik batang ganda + garis (SVG, tanpa dependensi baru) ----------
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const frac = value / base;
  return (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * base;
}

function BarChart<T extends { label: string }>({
  items,
  series,
  height = 240,
}: {
  items: T[];
  series: { key: string; label: string; color: string; get: (it: T) => number }[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => setWidth(Math.round(es[0]?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PAD = { top: 12, right: 12, bottom: 34, left: 62 };
  const max = niceMax(
    items.reduce((m, it) => Math.max(m, ...series.map((s) => Math.abs(s.get(it)))), 0)
  );
  const hasData = items.some((it) => series.some((s) => s.get(it) !== 0));
  if (!hasData) return <p className="py-6 text-center text-sm text-slate-400">Belum ada data</p>;
  if (width === 0) return <div ref={ref} style={{ height }} />;

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const step = innerW / Math.max(1, items.length);
  const barW = Math.min(Math.max((step / series.length) * 0.6, 3), 26);
  const py = (v: number) => PAD.top + innerH * (1 - v / max);
  const labelIdx = items.map((_, i) => i).filter((i) => {
    if (items.length <= 12) return true;
    return i % Math.ceil(items.length / 12) === 0 || i === items.length - 1;
  });

  return (
    <div ref={ref}>
      <div className="mb-3 flex items-center gap-4">
        {series.map((s) => (
          <span key={s.key} className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-slate-600">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg width={width} height={height} className="block w-full" role="img">
        {[0, 1, 2, 3, 4].map((i) => {
          const v = (max / 4) * i;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={PAD.left + innerW} y1={py(v)} y2={py(v)} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD.left - 8} y={py(v) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">
                {v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : v >= 1000 ? `${Math.round(v / 1000)} rb` : Math.round(v)}
              </text>
            </g>
          );
        })}
        {items.map((it, i) => {
          const cx = PAD.left + (i + 0.5) * step;
          return (
            <g key={i}>
              {series.map((s, si) => {
                const v = s.get(it);
                if (v <= 0) return null;
                const h = Math.max(2, Math.round((innerH * v) / max));
                const x = cx - (series.length * (barW + 3)) / 2 + si * (barW + 3);
                return <rect key={s.key} x={x} y={py(v)} width={barW} height={h} rx={2.5} fill={s.color}><title>{`${it.label}: ${s.label} Rp ${formatRupiah(v)}`}</title></rect>;
              })}
            </g>
          );
        })}
        {labelIdx.map((i) => (
          <text key={i} x={PAD.left + (i + 0.5) * step} y={height - 10} textAnchor="middle" fontSize="10" fill="#64748b">
            {items[i].label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function LineChart<T extends { label: string }>({ items, get, color, height = 220 }: { items: T[]; get: (it: T) => number; color: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => setWidth(Math.round(es[0]?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const PAD = { top: 12, right: 12, bottom: 34, left: 62 };
  const vals = items.map((it) => get(it));
  const max = niceMax(vals.reduce((m, v) => Math.max(m, v), 0));
  const min = Math.min(0, ...vals);
  const span = max - min || 1;
  const hasData = vals.some((v) => v !== 0);
  if (!hasData) return <p className="py-6 text-center text-sm text-slate-400">Belum ada data</p>;
  if (width === 0) return <div ref={ref} style={{ height }} />;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const px = (i: number) => (items.length === 1 ? PAD.left + innerW / 2 : PAD.left + (i * innerW) / (items.length - 1));
  const py = (v: number) => PAD.top + innerH * (1 - (v - min) / span);
  const axis = (v: number) =>
    v >= 1_000_000 || v <= -1_000_000
      ? `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
      : Math.abs(v) >= 1000
        ? `${Math.round(v / 1000)} rb`
        : Math.round(v);
  const d = items.map((it, i) => `${i === 0 ? "M" : "L"} ${px(i).toFixed(1)} ${py(get(it)).toFixed(1)}`).join(" ");
  return (
    <div ref={ref}>
      <svg width={width} height={height} className="block w-full" role="img">
        {[0, 1, 2, 3, 4].map((i) => {
          const v = min + (span / 4) * i;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={PAD.left + innerW} y1={py(v)} y2={py(v)} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD.left - 8} y={py(v) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">
                {axis(v)}
              </text>
            </g>
          );
        })}
        {min < 0 && (
          <line x1={PAD.left} x2={PAD.left + innerW} y1={py(0)} y2={py(0)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
        )}
        <path d={d} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {items.map((it, i) => (
          <g key={i}>
            <circle cx={px(i)} cy={py(get(it))} r="3.5" fill={color} stroke="#fff" strokeWidth="2">
              <title>{`${it.label}: Rp ${formatRupiah(get(it))}`}</title>
            </circle>
            {(items.length <= 12 || i % Math.ceil(items.length / 12) === 0 || i === items.length - 1) && (
              <text x={px(i)} y={height - 10} textAnchor="middle" fontSize="10" fill="#64748b">{it.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ================= SECTION 1: ARUS KAS =================
type ArusKasData = { totalMasuk: number; totalKeluar: number; bersih: number; items: { label: string; masuk: number; keluar: number; bersih: number }[] };
function ArusKasSection() {
  const [periode, setPeriode] = useState("bulan-ini");
  const [view, setView] = useState<"grafik" | "tabel">("grafik");
  const { data, loading, error } = useSection<ArusKasData>("arus-kas", periode);
  return (
    <SectionShell
      title="Arus Kas"
      desc="Kas masuk, kas keluar, dan perpindahan kas bersih dari transaksi Kas & Bank."
      filter={<><PeriodeSelect value={periode} onChange={setPeriode} /><ViewToggle view={view} onChange={setView} /></>}
    >
      <StateMsg loading={loading} error={error} />
      {data && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="text-xs text-slate-500">Total Kas Masuk</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-green-700">Rp {formatRupiah(data.totalMasuk)}</div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="text-xs text-slate-500">Total Kas Keluar</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-red-600">Rp {formatRupiah(data.totalKeluar)}</div>
            </div>
            <div className={`rounded-xl border p-4 ${data.bersih >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <div className="text-xs text-slate-500">Perpindahan Kas Bersih</div>
              <div className={`mt-1 text-xl font-semibold tabular-nums ${data.bersih >= 0 ? "text-green-700" : "text-red-600"}`}>Rp {formatRupiah(data.bersih)}</div>
            </div>
          </div>
          {view === "grafik" ? (
            <BarChart
              items={data.items}
              series={[
                { key: "masuk", label: "Masuk", color: "#16a34a", get: (it) => it.masuk },
                { key: "keluar", label: "Keluar", color: "#ef4444", get: (it) => it.keluar },
              ]}
            />
          ) : (
            <PagedTable
              head={<><TableHead>Periode</TableHead><TableHead className="text-right">Total Kas Masuk</TableHead><TableHead className="text-right">Total Kas Keluar</TableHead><TableHead className="text-right">Perpindahan Kas Bersih</TableHead></>}
              rows={data.items}
              renderRow={(it) => (
                <TableRow key={it.label}>
                  <TableCell className="text-xs font-medium text-slate-600">{it.label}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">Rp {formatRupiah(it.masuk)}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">Rp {formatRupiah(it.keluar)}</TableCell>
                  <TableCell className={`text-right text-xs font-medium tabular-nums ${it.bersih >= 0 ? "text-green-700" : "text-red-600"}`}>Rp {formatRupiah(it.bersih)}</TableCell>
                </TableRow>
              )}
            />
          )}
        </div>
      )}
    </SectionShell>
  );
}

// ================= SECTION 2 & 3: TERHUTANG =================
type TerhutangData = { belumDibayar: { count: number; nominal: number }; telatDibayar: { count: number; nominal: number }; lunas: { count: number; nominal: number } };
function TerhutangSection({ section, title, desc }: { section: "penjualan-terhutang" | "tagihan-belum-dibayar"; title: string; desc: string }) {
  const [periode, setPeriode] = useState("bulan-ini");
  const { data, loading, error } = useSection<TerhutangData>(section, periode);
  const cards = data ? [
    { label: "Belum Dibayar", count: data.belumDibayar.count, nominal: data.belumDibayar.nominal, box: "border-amber-200 bg-amber-50", value: "text-amber-700" },
    { label: "Telat Dibayar", count: data.telatDibayar.count, nominal: data.telatDibayar.nominal, box: "border-red-200 bg-red-50", value: "text-red-600" },
  ] : [];
  const lunas = data ? { count: data.lunas.count, nominal: data.lunas.nominal } : null;
  return (
    <SectionShell title={title} desc={desc} filter={<PeriodeSelect value={periode} onChange={setPeriode} />}>
      <StateMsg loading={loading} error={error} />
      {data && lunas && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 items-stretch">
            {cards.map((c) => (
              <div key={c.label} className={`flex flex-col rounded-xl border p-4 ${c.box}`}>
                <div className="text-xs font-medium text-slate-500">{c.label}</div>
                <div className={`mt-2 text-xl font-semibold tabular-nums ${c.value}`}>Rp {formatRupiah(c.nominal)}</div>
                <div className="mt-auto pt-2 text-xs text-slate-400">{c.count} transaksi</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col rounded-xl border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <div className="text-xs font-medium text-slate-500">Lunas</div>
              <div className="mt-2 text-xl font-semibold tabular-nums text-green-700">Rp {formatRupiah(lunas.nominal)}</div>
            </div>
            <div className="mt-1 text-xs text-slate-400 sm:mt-0 sm:text-right">{lunas.count} transaksi</div>
          </div>
        </div>
      )}
    </SectionShell>
  );
}

// ================= SECTION 4: LABA RUGI =================
type LabaRugiData = { pendapatan: number; beban: number; labaBersih: number; basis: string; items: { label: string; pendapatan: number; beban: number; laba: number }[] };
function LabaRugiSection() {
  const [periode, setPeriode] = useState("bulan-ini");
  const [view, setView] = useState<"grafik" | "tabel">("grafik");
  const { data, loading, error } = useSection<LabaRugiData>("laba-rugi", periode);
  return (
    <SectionShell
      title="Laba Rugi"
      desc="Pendapatan vs beban basis kas dari transaksi Kas & Bank pada periode."
      filter={<><PeriodeSelect value={periode} onChange={setPeriode} /><ViewToggle view={view} onChange={setView} /></>}
    >
      <StateMsg loading={loading} error={error} />
      {data && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="text-xs text-slate-500">Pendapatan</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-green-700">Rp {formatRupiah(data.pendapatan)}</div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="text-xs text-slate-500">Beban</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-red-600">Rp {formatRupiah(data.beban)}</div>
            </div>
            <div className={`rounded-xl border p-4 ${data.labaBersih >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <div className="text-xs text-slate-500">Laba Bersih</div>
              <div className={`mt-1 text-xl font-semibold tabular-nums ${data.labaBersih >= 0 ? "text-green-700" : "text-red-600"}`}>Rp {formatRupiah(data.labaBersih)}</div>
            </div>
          </div>
          {view === "grafik" ? (
            <BarChart
              items={data.items}
              series={[
                { key: "pendapatan", label: "Pendapatan", color: "#16a34a", get: (it) => it.pendapatan },
                { key: "beban", label: "Beban", color: "#ef4444", get: (it) => it.beban },
                { key: "laba", label: "Laba Bersih", color: "#0f766e", get: (it) => it.laba },
              ]}
            />
          ) : (
            <PagedTable
              head={<><TableHead>Periode</TableHead><TableHead className="text-right">Pendapatan</TableHead><TableHead className="text-right">Beban</TableHead><TableHead className="text-right">Laba Bersih</TableHead></>}
              rows={data.items}
              renderRow={(it) => (
                <TableRow key={it.label}>
                  <TableCell className="text-xs font-medium text-slate-600">{it.label}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">Rp {formatRupiah(it.pendapatan)}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">Rp {formatRupiah(it.beban)}</TableCell>
                  <TableCell className={`text-right text-xs font-medium tabular-nums ${it.laba >= 0 ? "text-green-700" : "text-red-600"}`}>Rp {formatRupiah(it.laba)}</TableCell>
                </TableRow>
              )}
            />
          )}
        </div>
      )}
    </SectionShell>
  );
}

// ================= SECTION 5: BIAYA OPERASIONAL =================
type BiayaData = { total: number; items: { kategori: string; nominal: number; count: number }[] };
function BiayaOperasionalSection() {
  const [periode, setPeriode] = useState("bulan-ini");
  const { data, loading, error } = useSection<BiayaData>("biaya-operasional", periode);
  return (
    <SectionShell
      title="Biaya Operasional"
      desc="Rincian beban operasional per kategori dari transaksi pengeluaran."
      filter={<PeriodeSelect value={periode} onChange={setPeriode} />}
    >
      <StateMsg loading={loading} error={error} empty={!!data && data.items.length === 0} />
      {data && data.items.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Total Biaya Operasional</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">Rp {formatRupiah(data.total)}</div>
          </div>
          <ul className="space-y-3">
            {data.items.map((it) => (
              <li key={it.kategori}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-700">{it.kategori}</span>
                  <span className="text-xs text-slate-500">Rp {formatRupiah(it.nominal)} · {it.count}x</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${data.total > 0 ? Math.max(2, (it.nominal / data.total) * 100) : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionShell>
  );
}

// ================= SECTION 6: AKUN TERPANTAU =================
type AkunData = { akun: { kode: string; nama: string; bulanIni: number; tahunIni: number; countBulan?: number; countTahun?: number }[] };
function AkunTerpantauSection() {
  const [periode, setPeriode] = useState("bulan-ini");
  const { data, loading, error } = useSection<AkunData>("akun-terpantau", "bulan-ini");
  const tahun = periode === "tahun-ini";
  return (
    <SectionShell
      title="Daftar Akun Terpantau"
      desc="Saldo akun penting: Kas/Bank/Tabungan (arus bersih) serta Piutang & Utang (sisa berjalan)."
      filter={
        <Select value={periode} onChange={(e) => setPeriode(e.target.value)} className="w-auto text-xs" aria-label="Filter periode akun">
          <option value="bulan-ini">Bulan ini</option>
          <option value="tahun-ini">Tahun ini</option>
        </Select>
      }
    >
      <StateMsg loading={loading} error={error} />
      {data && (
        <PagedTable
          head={<><TableHead>Akun COA</TableHead><TableHead className="text-right">Saldo {tahun ? "Tahun ini" : "Bulan ini"}</TableHead></>}
          rows={data.akun}
          renderRow={(a) => (
            <TableRow key={a.kode}>
              <TableCell className="text-sm font-medium text-slate-700">{a.kode} - {a.nama}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">Rp {formatRupiah(tahun ? a.tahunIni : a.bulanIni)}</TableCell>
            </TableRow>
          )}
        />
      )}
    </SectionShell>
  );
}

// ================= SECTION 7: PRODUK TERLARIS =================
type ProdukData = { items: { deskripsi: string; unit: string; qty: number; nilai: number; transaksi: number }[] };
function ProdukTerlarisSection() {
  const [periode, setPeriode] = useState("bulan-ini");
  const [dari, setDari] = useState(todayYMD());
  const [sampai, setSampai] = useState(todayYMD());
  const extra = periode === "custom" ? `&dari=${dari}&sampai=${sampai}` : "";
  const { data, loading, error } = useSection<ProdukData>("produk-terlaris", periode, extra);
  return (
    <SectionShell
      title="Produk Terlaris"
      desc="Peringkat penjualan dari item Penagihan nyata, berdasarkan nilai tertinggi."
      filter={
        <>
          <PeriodeSelect value={periode} onChange={setPeriode} options={PERIODE_PRODUK} />
          {periode === "custom" && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className="h-9 w-auto text-xs" aria-label="Dari tanggal" />
              <span>–</span>
              <Input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className="h-9 w-auto text-xs" aria-label="Sampai tanggal" />
            </span>
          )}
        </>
      }
    >
      <StateMsg loading={loading} error={error} empty={!!data && data.items.length === 0} />
      {data && data.items.length > 0 && (
        <PagedTable
          head={<><TableHead>#</TableHead><TableHead>Produk</TableHead><TableHead className="text-right">Terjual</TableHead><TableHead className="text-right">Nilai</TableHead><TableHead className="text-right">Transaksi</TableHead></>}
          rows={data.items}
          renderRow={(it, i) => (
            <TableRow key={`${it.deskripsi}-${i}`}>
              <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
              <TableCell className="text-sm font-medium text-slate-700">{it.deskripsi}</TableCell>
              <TableCell className="text-right text-xs tabular-nums">{it.qty.toLocaleString("id-ID")} {it.unit}</TableCell>
              <TableCell className="text-right text-sm font-medium tabular-nums">Rp {formatRupiah(it.nilai)}</TableCell>
              <TableCell className="text-right text-xs text-slate-400">{it.transaksi}x</TableCell>
            </TableRow>
          )}
        />
      )}
    </SectionShell>
  );
}

// ================= SECTION 8: PIUTANG USAHA =================
type PiutangData = { saldo: number; count: number; items: { label: string; terbentuk: number; terlunasi: number; saldo: number }[] };
function PiutangUsahaSection() {
  const [periode, setPeriode] = useState("bulanan");
  const { data, loading, error } = useSection<PiutangData>("piutang-usaha", periode);
  return (
    <SectionShell
      title="Piutang Usaha"
      desc="Saldo piutang berjalan serta piutang terbentuk vs pelunasan dari transaksi nyata."
      filter={
        <Select value={periode} onChange={(e) => setPeriode(e.target.value)} className="w-auto text-xs" aria-label="Filter piutang">
          <option value="harian">Harian</option>
          <option value="bulanan">Bulanan</option>
        </Select>
      }
    >
      <StateMsg loading={loading} error={error} />
      {data && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-medium text-slate-500">Saldo Piutang (belum lunas)</div>
            <div className="mt-2 text-xl font-semibold tabular-nums text-amber-700">Rp {formatRupiah(data.saldo)}</div>
            <div className="mt-1 text-xs text-slate-400">{data.count} piutang terbuka</div>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-slate-500">Perkembangan saldo piutang</div>
            <LineChart items={data.items} get={(it) => it.saldo} color="#16a34a" />
          </div>
        </div>
      )}
    </SectionShell>
  );
}

// ================= SECTION 9: KAS =================
type KasData = { saldoBank: number; saldoJurnal: number; rekonsiliasi: { perlu: number; didukung: boolean }; items: { label: string; saldo: number }[] };
function KasSection() {
  const [periode, setPeriode] = useState("bulanan");
  const { data, loading, error } = useSection<KasData>("kas", periode);
  return (
    <SectionShell
      title="Kas"
      desc="Posisi kas dari transaksi Kas & Bank. Rekonsiliasi belum didukung sistem."
      filter={
        <Select value={periode} onChange={(e) => setPeriode(e.target.value)} className="w-auto text-xs" aria-label="Filter kas">
          <option value="harian">Harian</option>
          <option value="bulanan">Bulanan</option>
        </Select>
      }
    >
      <StateMsg loading={loading} error={error} />
      {data && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Saldo di Bank</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">Rp {formatRupiah(data.saldoBank)}</div>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="text-xs text-slate-500">Saldo di Jurnal</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-green-700">Rp {formatRupiah(data.saldoJurnal)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Perlu Rekonsiliasi</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{data.rekonsiliasi.perlu} transaksi</div>
              <div className="mt-1 text-xs text-slate-400">Fitur rekonsiliasi belum tersedia</div>
            </div>
          </div>
          <LineChart items={data.items} get={(it) => it.saldo} color="#16a34a" />
        </div>
      )}
    </SectionShell>
  );
}

export function DashboardKeuangan() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <ArusKasSection />
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <TerhutangSection section="penjualan-terhutang" title="Penjualan Terhutang" desc="Status piutang penjualan (belum, telat, lunas) pada periode." />
        <TerhutangSection section="tagihan-belum-dibayar" title="Tagihan Belum Dibayar" desc="Status hutang usaha (belum, telat, lunas) pada periode." />
      </div>
      <LabaRugiSection />
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <BiayaOperasionalSection />
        <AkunTerpantauSection />
      </div>
      <ProdukTerlarisSection />
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <PiutangUsahaSection />
        <KasSection />
      </div>
    </div>
  );
}
