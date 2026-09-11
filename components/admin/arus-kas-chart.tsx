"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRupiah, formatRupiahCompact } from "@/lib/utils";

type Periode = "7-hari" | "bulan-ini" | "6-bulan" | "1-tahun";
type ChartItem = { key: string; pemasukan: number; pengeluaran: number };

const PERIODE_OPTIONS: { value: Periode; label: string }[] = [
  { value: "7-hari", label: "7 Hari" },
  { value: "bulan-ini", label: "Bulan Ini" },
  { value: "6-bulan", label: "6 Bulan" },
  { value: "1-tahun", label: "1 Tahun" },
];

const CHART_HEIGHT = 280;
const PAD = { top: 12, right: 16, bottom: 36, left: 68 };
const TOOLTIP_WIDTH = 224;
const Y_TICKS = 5;
const MIN_LABEL_PX = 46;

function formatLabel(key: string, full = false) {
  const isDay = key.length === 10;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, isDay ? d : 1);
  if (isDay) {
    return date.toLocaleDateString(
      "id-ID",
      full ? { day: "2-digit", month: "short", year: "numeric" } : { day: "numeric", month: "short" }
    );
  }
  return date.toLocaleDateString("id-ID", { month: full ? "long" : "short", year: "numeric" });
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const factor = value / base;
  const nice = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10;
  return nice * base;
}

// Pilih indeks label x yang tersebar merata dan tidak saling bertumpuk.
// Selalu sertakan indeks pertama dan terakhir.
function pickLabelIndices(n: number, groupStep: number): number[] {
  if (n <= 1) return [0];
  const indices: number[] = [0];
  let lastX = 0;
  for (let i = 1; i < n - 1; i++) {
    const x = i * groupStep;
    const remaining = (n - 1 - i) * groupStep;
    if (x - lastX >= MIN_LABEL_PX && remaining >= MIN_LABEL_PX * 0.7) {
      indices.push(i);
      lastX = x;
    }
  }
  const finalX = (n - 1) * groupStep;
  // Label terakhir dipertahankan jika tidak terlalu dekat dengan label sebelumnya.
  if (finalX - (indices[indices.length - 1] * groupStep) >= MIN_LABEL_PX * 0.7) {
    indices.push(n - 1);
  }
  return indices;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function ArusKasChart({ refreshKey = 0 }: { refreshKey?: number }) {
  const [periode, setPeriode] = useState<Periode>("bulan-ini");
  const [items, setItems] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.getBoundingClientRect().width;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(Math.round(w)));
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/keuangan/chart?periode=${periode}`)
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result.success) setItems(result.data.items);
        else setError(result.message || "Gagal memuat grafik");
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat grafik");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [periode, refreshKey]);

  const changePeriode = (next: Periode) => {
    if (next === periode) return;
    setPeriode(next);
    setItems([]);
    setLoading(true);
    setHoverIndex(null);
    setError("");
  };

  const handlePointerMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || width === 0 || items.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left;
    const innerWidth = Math.max(0, width - PAD.left - PAD.right);
    const groupStep = innerWidth / items.length;
    const index = Math.floor((x - PAD.left) / groupStep);
    setHoverIndex(Math.max(0, Math.min(items.length - 1, index)));
  };

  const handlePointerLeave = () => setHoverIndex(null);

  const hasData = items.some((item) => item.pemasukan > 0 || item.pengeluaran > 0);

  const renderBody = () => {
    if (loading) {
      return (
        <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
          Memuat data...
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex h-[280px] items-center justify-center text-sm text-red-600">{error}</div>
      );
    }
    if (!hasData) {
      return (
        <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
          Belum ada transaksi pada periode ini
        </div>
      );
    }
    if (width === 0) {
      return <div className="h-[280px]" />;
    }

    const n = items.length;
    const maxValue = niceMax(Math.max(...items.map((item) => Math.max(item.pemasukan, item.pengeluaran))));
    const innerWidth = Math.max(0, width - PAD.left - PAD.right);
    const innerHeight = CHART_HEIGHT - PAD.top - PAD.bottom;
    const groupStep = innerWidth / Math.max(1, n);
    const barW = Math.min(Math.max(groupStep * 0.32, 3), 22);
    const gap = 3;

    const px = (i: number) => Math.round(PAD.left + (i + 0.5) * groupStep);
    const py = (value: number) => Math.round(PAD.top + innerHeight * (1 - value / maxValue));
    const barHeight = (value: number) => Math.max(2, Math.round(innerHeight * (value / maxValue)));

    const labelIndices = pickLabelIndices(n, groupStep);

    const hoverItem = hoverIndex !== null ? items[hoverIndex] : undefined;
    const showHover = Boolean(
      hoverItem && (hoverItem.pemasukan > 0 || hoverItem.pengeluaran > 0)
    );

    const tooltipLeft =
      hoverIndex !== null
        ? Math.min(Math.max(px(hoverIndex) - TOOLTIP_WIDTH / 2, 4), Math.max(4, width - TOOLTIP_WIDTH - 4))
        : 0;

    return (
      <div className="relative">
        <svg
          ref={svgRef}
          width={width}
          height={CHART_HEIGHT}
          className="block w-full"
          role="img"
          aria-label="Grafik arus kas pemasukan dan pengeluaran"
          onMouseMove={(event) => handlePointerMove(event.clientX)}
          onMouseLeave={handlePointerLeave}
          onTouchMove={(event) => handlePointerMove(event.touches[0]?.clientX ?? 0)}
          onTouchEnd={handlePointerLeave}
        >
          {Array.from({ length: Y_TICKS + 1 }).map((_, i) => {
            const tickValue = (maxValue / Y_TICKS) * i;
            const y = py(tickValue);
            return (
              <g key={i}>
                <line x1={PAD.left} x2={PAD.left + innerWidth} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                <text x={PAD.left - 10} y={y + 3.5} textAnchor="end" className="fill-slate-400" style={{ fontSize: 10 }}>
                  {formatRupiahCompact(tickValue)}
                </text>
              </g>
            );
          })}

          {items.map((item, i) => {
            const x = px(i);
            const pemasukanHeight = item.pemasukan > 0 ? barHeight(item.pemasukan) : 0;
            const pengeluaranHeight = item.pengeluaran > 0 ? barHeight(item.pengeluaran) : 0;
            return (
              <g key={item.key}>
                {pemasukanHeight > 0 && (
                  <rect
                    x={x - barW - gap / 2}
                    y={py(item.pemasukan)}
                    width={barW}
                    height={pemasukanHeight}
                    rx={2.5}
                    fill="#16a34a"
                  />
                )}
                {pengeluaranHeight > 0 && (
                  <rect
                    x={x + gap / 2}
                    y={py(item.pengeluaran)}
                    width={barW}
                    height={pengeluaranHeight}
                    rx={2.5}
                    fill="#ef4444"
                  />
                )}
              </g>
            );
          })}

          {labelIndices.map((i) => {
            const item = items[i];
            const label = formatLabel(item.key);
            return (
              <text
                key={item.key}
                x={i === 0 ? PAD.left + 3 : i === n - 1 ? PAD.left + innerWidth - 3 : px(i)}
                y={CHART_HEIGHT - 10}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                className="fill-slate-400"
                style={{ fontSize: 10 }}
              >
                {label}
              </text>
            );
          })}

          {showHover && hoverIndex !== null && (
            <line
              x1={px(hoverIndex)}
              x2={px(hoverIndex)}
              y1={PAD.top}
              y2={PAD.top + innerHeight}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}

          <rect x={0} y={0} width={width} height={CHART_HEIGHT} fill="transparent" />
        </svg>

        {showHover && hoverItem && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-xl border border-slate-100 bg-white p-3 shadow-lg"
            style={{ left: tooltipLeft, top: 8 }}
          >
            <div className="text-xs font-medium text-slate-700">{formatLabel(hoverItem.key, true)}</div>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-green-600" /> Pemasukan
                </span>
                <span className="font-medium text-slate-900">{formatRupiah(hoverItem.pemasukan)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> Pengeluaran
                </span>
                <span className="font-medium text-slate-900">{formatRupiah(hoverItem.pengeluaran)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-sm">Grafik Arus Kas</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Pemasukan dan pengeluaran berdasarkan periode yang dipilih.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <LegendItem color="#16a34a" label="Pemasukan" />
            <LegendItem color="#ef4444" label="Pengeluaran" />
          </div>
          <div className="flex items-center gap-1">
            {PERIODE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={periode === option.value ? "default" : "outline"}
                onClick={() => changePeriode(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div ref={containerRef}>{renderBody()}</div>
      </CardContent>
    </Card>
  );
}