"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Periode = "7-hari" | "bulan-ini" | "6-bulan" | "1-tahun";
type Item = { key: string; value: number; count: number };

const PERIODE_OPTIONS: { value: Periode; label: string }[] = [
  { value: "7-hari", label: "7 Hari" },
  { value: "bulan-ini", label: "Bulan Ini" },
  { value: "6-bulan", label: "6 Bulan" },
  { value: "1-tahun", label: "1 Tahun" },
];

const CHART_HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 36, left: 56 };

function formatLabel(key: string, full = false) {
  const isDay = key.length === 10;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, isDay ? d : 1);
  if (isDay) {
    return date.toLocaleDateString("id-ID", full ? { day: "2-digit", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  }
  return date.toLocaleDateString("id-ID", { month: full ? "long" : "short", year: "numeric" });
}
function formatKg(n: number) {
  if (n >= 1000) return `${(n / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} ton`;
  return `${Math.round(n).toLocaleString("id-ID")} KG`;
}
function niceMax(v: number) {
  if (v <= 0) return 10;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const factor = v / base;
  const nice = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10;
  return nice * base;
}

export function PanenChart({ refreshKey = 0 }: { refreshKey?: number }) {
  const [periode, setPeriode] = useState<Periode>("6-bulan");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
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
    setLoading(true);
    setError("");
    fetch(`/api/perkebunan/chart?type=trend&periode=${periode}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success) setItems(j.data.items);
        else setError(j.message || "Gagal memuat");
      })
      .catch(() => !cancelled && setError("Gagal memuat"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [periode, refreshKey]);

  const hasData = items.some((i) => i.value > 0);
  const max = niceMax(Math.max(...items.map((i) => i.value), 0));

  const handlePointerMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || width === 0 || items.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left;
    const innerWidth = Math.max(0, width - PAD.left - PAD.right);
    const step = innerWidth / Math.max(1, items.length);
    const idx = Math.floor((x - PAD.left) / step);
    setHoverIndex(Math.max(0, Math.min(items.length - 1, idx)));
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-sm">Grafik Panen</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Total KG per periode — data Panen harian</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {PERIODE_OPTIONS.map((o) => (
            <Button key={o.value} size="sm" variant={periode === o.value ? "default" : "outline"} onClick={() => setPeriode(o.value)} className="h-8 text-xs">
              {o.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div ref={containerRef}>
          {loading ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">Memuat...</div>
          ) : error ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-red-600">{error}</div>
          ) : !hasData ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">Belum ada panen pada periode ini</div>
          ) : width === 0 ? (
            <div className="h-[260px]" />
          ) : (
            <div className="relative">
              <svg
                ref={svgRef}
                width={width}
                height={CHART_HEIGHT}
                className="block w-full"
                onMouseMove={(e) => handlePointerMove(e.clientX)}
                onMouseLeave={() => setHoverIndex(null)}
                onTouchMove={(e) => handlePointerMove(e.touches[0]?.clientX ?? 0)}
                onTouchEnd={() => setHoverIndex(null)}
              >
                {/* grid */}
                {Array.from({ length: 5 }).map((_, i) => {
                  const v = (max / 4) * i;
                  const y = PAD.top + (CHART_HEIGHT - PAD.top - PAD.bottom) * (1 - v / max);
                  return (
                    <g key={i}>
                      <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                      <text x={PAD.left - 8} y={y + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: 10 }}>
                        {formatKg(v)}
                      </text>
                    </g>
                  );
                })}
                {/* bars */}
                {(() => {
                  const innerW = width - PAD.left - PAD.right;
                  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
                  const step = innerW / Math.max(1, items.length);
                  const barW = Math.min(Math.max(step * 0.45, 6), 28);
                  return items.map((item, i) => {
                    const x = PAD.left + i * step + (step - barW) / 2;
                    const h = item.value > 0 ? Math.max(4, (item.value / max) * innerH) : 0;
                    const y = PAD.top + innerH - h;
                    const isHover = hoverIndex === i;
                    return (
                      <g key={item.key}>
                        <rect x={x} y={y} width={barW} height={h} rx={4} fill={isHover ? "#15803d" : "#16a34a"} />
                        <text
                          x={x + barW / 2}
                          y={CHART_HEIGHT - 12}
                          textAnchor="middle"
                          className="fill-slate-400"
                          style={{ fontSize: 10 }}
                        >
                          {i % Math.ceil(items.length / 6) === 0 || i === items.length - 1 ? formatLabel(item.key) : ""}
                        </text>
                      </g>
                    );
                  });
                })()}
                {hoverIndex !== null && items[hoverIndex] && (
                  <line
                    x1={PAD.left + (width - PAD.left - PAD.right) / items.length * (hoverIndex + 0.5)}
                    x2={PAD.left + (width - PAD.left - PAD.right) / items.length * (hoverIndex + 0.5)}
                    y1={PAD.top}
                    y2={CHART_HEIGHT - PAD.bottom}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                  />
                )}
                <rect x={0} y={0} width={width} height={CHART_HEIGHT} fill="transparent" />
              </svg>
              {hoverIndex !== null && items[hoverIndex] && items[hoverIndex].value > 0 && (
                <div
                  className="pointer-events-none absolute z-10 rounded-xl border border-slate-100 bg-white p-3 shadow-lg"
                  style={{
                    left: Math.min(Math.max((width / items.length) * (hoverIndex + 0.5) + PAD.left - 90, 8), width - 188),
                    top: 8,
                  }}
                >
                  <div className="text-xs font-medium text-slate-700">{formatLabel(items[hoverIndex].key, true)}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{formatKg(items[hoverIndex].value)}</div>
                  <div className="text-xs text-slate-500">{items[hoverIndex].count} panen</div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
