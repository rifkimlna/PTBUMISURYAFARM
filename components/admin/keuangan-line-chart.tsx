"use client";

import { formatRupiah } from "@/lib/utils";

type DataPoint = {
  label: string;
  pemasukan: number;
  pengeluaran: number;
};

const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 34, left: 72 };

type Pt = { x: number; y: number };

// Kurva halus (Catmull-Rom -> Bezier) agar garis terlihat rapi, bukan patah-patah.
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

// Bulatkan batas atas sumbu-Y ke angka rapi (tanpa faktor 2.5 agar ticks tidak janggal).
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const frac = value / base;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 4 ? 4 : frac <= 5 ? 5 : 10;
  return niceFrac * base;
}

// Label sumbu-Y ringkas TANPA pengulangan "Rp", satuan diseragamkan mengikuti skala.
// Contoh skala jutaan: "0", "500 rb", "1 jt", "1,5 jt". Contoh skala ribuan: "0", "5 rb", "10 rb".
function formatAxis(value: number, max: number): string {
  if (value === 0) return "0";
  if (max >= 1_000_000) {
    if (Math.abs(value) >= 1_000_000) {
      const s = (value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 });
      return `${s} jt`;
    }
    return `${Math.round(value / 1_000)} rb`;
  }
  if (max >= 1_000) {
    return `${Math.round(value / 1_000)} rb`;
  }
  return `${Math.round(value)}`;
}

function deltaText(last: number, prev: number): string | null {
  if (prev === 0) return last > 0 ? "mulai ada" : null;
  const pct = ((last - prev) / Math.abs(prev)) * 100;
  if (!Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${Math.round(pct)}% vs bln lalu`;
}

function renderSingleLineChart({
  data,
  dataKey,
  color,
  fillColor,
  fillOpacity,
  label,
  delta,
}: {
  data: DataPoint[];
  dataKey: "pemasukan" | "pengeluaran";
  color: string;
  fillColor: string;
  fillOpacity: number;
  label: string;
  delta: string | null;
}) {
  const isEmpty = data.length === 0 || data.every((d) => d[dataKey] === 0);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const rawMax = data.reduce((m, d) => Math.max(m, d[dataKey]), 0);
  const max = niceMax(rawMax);
  const ticks = [0, 1, 2, 3].map((i) => (max * i) / 3);

  const getX = (i: number) =>
    data.length === 1 ? PAD.left + innerW / 2 : PAD.left + (i * innerW) / (data.length - 1);
  const getY = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const baselineY = getY(0);

  const pts: Pt[] = data.map((d, i) => ({ x: getX(i), y: getY(d[dataKey]) }));
  const line = smoothPath(pts);

  if (data.length === 0) return null;

  return (
    <div className="w-full" style={{ height: H }}>
      {isEmpty ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 text-center">
          <p className="text-sm font-medium text-slate-500">Belum ada data {label.toLowerCase()}</p>
          <p className="text-xs text-slate-400">Grafik akan muncul setelah ada transaksi kas.</p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Grafik ${label}`}
        >
          <defs>
            <linearGradient id={`${dataKey}Fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={fillOpacity} />
              <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid horizontal + label sumbu Y */}
          {ticks.map((t, i) => {
            const y = getY(t);
            return (
              <g key={i}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={PAD.left - 10} y={y} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#94a3b8">
                  {formatAxis(t, max)}
                </text>
              </g>
            );
          })}

          {/* Area halus di bawah garis */}
          <path
            d={`${line} L ${getX(data.length - 1).toFixed(2)} ${baselineY} L ${getX(0).toFixed(2)} ${baselineY} Z`}
            fill={`url(#${dataKey}Fill)`}
          />

          {/* Garis tren */}
          <path
            d={line}
            stroke={color}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Titik data + tooltip bawaan browser (nominal penuh) */}
          {data.map((d, i) => (
            <g key={`${dataKey}-pt-${i}`}>
              <circle cx={getX(i)} cy={getY(d[dataKey])} r="4" fill={color} stroke="#fff" strokeWidth="2">
                <title>{`${d.label}: ${label} Rp ${formatRupiah(d[dataKey])}`}</title>
              </circle>
            </g>
          ))}

          {/* Label sumbu X */}
          {data.map((d, i) => (
            <text
              key={`${dataKey}-x-${i}`}
              x={getX(i)}
              y={H - 10}
              textAnchor="middle"
              fontSize="11"
              fill="#64748b"
            >
              {d.label}
            </text>
          ))}
        </svg>
      )}

      {/* Legenda delta */}
      {delta && (
        <div className="mt-2 text-center text-xs text-slate-500">
          <span className="font-medium text-slate-400">({delta})</span>
        </div>
      )}
    </div>
  );
}

export function KeuanganLineChart({ data, periodText = "periode ini" }: { data: DataPoint[]; periodText?: string }) {
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const masukDelta = last && prev ? deltaText(last.pemasukan, prev.pemasukan) : null;
  const keluarDelta = last && prev ? deltaText(last.pengeluaran, prev.pengeluaran) : null;

  if (data.length === 0) return null;

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      {renderSingleLineChart({
        data,
        dataKey: "pemasukan",
        color: "#16a34a",
        fillColor: "#16a34a",
        fillOpacity: 0.18,
        label: "Pemasukan",
        delta: masukDelta,
      })}
      {renderSingleLineChart({
        data,
        dataKey: "pengeluaran",
        color: "#ef4444",
        fillColor: "#ef4444",
        fillOpacity: 0.14,
        label: "Pengeluaran",
        delta: keluarDelta,
      })}
    </div>
  );
}

export function KeuanganLineChartCombined({ data, periodText = "periode ini" }: { data: DataPoint[]; periodText?: string }) {
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const masukDelta = last && prev ? deltaText(last.pemasukan, prev.pemasukan) : null;
  const keluarDelta = last && prev ? deltaText(last.pengeluaran, prev.pengeluaran) : null;

  if (data.length === 0) return null;

  const isEmpty = data.length === 0 || data.every((d) => d.pemasukan === 0 && d.pengeluaran === 0);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const rawMax = data.reduce((m, d) => Math.max(m, d.pemasukan, d.pengeluaran), 0);
  const max = niceMax(rawMax);
  const ticks = [0, 1, 2, 3].map((i) => (max * i) / 3);

  const getX = (i: number) =>
    data.length === 1 ? PAD.left + innerW / 2 : PAD.left + (i * innerW) / (data.length - 1);
  const getY = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const baselineY = getY(0);

  const ptsMasuk: Pt[] = data.map((d, i) => ({ x: getX(i), y: getY(d.pemasukan) }));
  const ptsKeluar: Pt[] = data.map((d, i) => ({ x: getX(i), y: getY(d.pengeluaran) }));
  const lineMasuk = smoothPath(ptsMasuk);
  const lineKeluar = smoothPath(ptsKeluar);

  return (
    <div className="w-full" style={{ height: H }}>
      {isEmpty ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 text-center">
          <p className="text-sm font-medium text-slate-500">Belum ada data arus kas</p>
          <p className="text-xs text-slate-400">Grafik akan muncul setelah ada transaksi kas.</p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Grafik arus kas ${periodText}`}
        >
          <defs>
            <linearGradient id="pemasukanFillCombined" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="pengeluaranFillCombined" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid horizontal + label sumbu Y */}
          {ticks.map((t, i) => {
            const y = getY(t);
            return (
              <g key={i}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={PAD.left - 10} y={y} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#94a3b8">
                  {formatAxis(t, max)}
                </text>
              </g>
            );
          })}

          {/* Area halus di bawah garis Pemasukan */}
          <path
            d={`${lineMasuk} L ${getX(data.length - 1).toFixed(2)} ${baselineY} L ${getX(0).toFixed(2)} ${baselineY} Z`}
            fill="url(#pemasukanFillCombined)"
          />

          {/* Area halus di bawah garis Pengeluaran */}
          <path
            d={`${lineKeluar} L ${getX(data.length - 1).toFixed(2)} ${baselineY} L ${getX(0).toFixed(2)} ${baselineY} Z`}
            fill="url(#pengeluaranFillCombined)"
          />

          {/* Garis tren Pemasukan */}
          <path
            d={lineMasuk}
            stroke="#16a34a"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Garis tren Pengeluaran */}
          <path
            d={lineKeluar}
            stroke="#ef4444"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Titik data Pemasukan + tooltip */}
          {data.map((d, i) => (
            <g key={`masuk-pt-${i}`}>
              <circle cx={getX(i)} cy={getY(d.pemasukan)} r="4" fill="#16a34a" stroke="#fff" strokeWidth="2">
                <title>{`${d.label}: Pemasukan Rp ${formatRupiah(d.pemasukan)}`}</title>
              </circle>
            </g>
          ))}

          {/* Titik data Pengeluaran + tooltip */}
          {data.map((d, i) => (
            <g key={`keluar-pt-${i}`}>
              <circle cx={getX(i)} cy={getY(d.pengeluaran)} r="4" fill="#ef4444" stroke="#fff" strokeWidth="2">
                <title>{`${d.label}: Pengeluaran Rp ${formatRupiah(d.pengeluaran)}`}</title>
              </circle>
            </g>
          ))}

          {/* Label sumbu X */}
          {data.map((d, i) => (
            <text
              key={`x-${i}`}
              x={getX(i)}
              y={H - 10}
              textAnchor="middle"
              fontSize="11"
              fill="#64748b"
            >
              {d.label}
            </text>
          ))}

          {/* Legenda */}
          <g transform={`translate(${W - PAD.right - 180}, ${PAD.top + 8})`}>
            <rect x="0" y="0" width="170" height="36" rx="4" fill="white" fillOpacity="0.9" stroke="#e2e8f0" />
            <circle cx="12" cy="10" r="5" fill="#16a34a" />
            <text x="22" y="13" fontSize="11" fill="#16a34a" fontWeight="600">Pemasukan</text>
            <circle cx="12" cy="26" r="5" fill="#ef4444" />
            <text x="22" y="29" fontSize="11" fill="#ef4444" fontWeight="600">Pengeluaran</text>
          </g>
        </svg>
      )}

      {/* Legenda delta */}
      {(masukDelta || keluarDelta) && (
        <div className="mt-2 text-center text-xs text-slate-500">
          {masukDelta && <span className="font-medium text-green-600 mr-3">({masukDelta})</span>}
          {keluarDelta && <span className="font-medium text-red-500">({keluarDelta})</span>}
        </div>
      )}
    </div>
  );
}
