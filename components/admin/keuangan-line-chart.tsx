"use client";

import { formatRupiah } from "@/lib/utils";

type DataPoint = {
  label: string;
  pemasukan: number;
  pengeluaran: number;
};

const W = 640;
const H = 280;
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

export function KeuanganLineChart({ data, periodText = "periode ini" }: { data: DataPoint[]; periodText?: string }) {
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

  const pemasukanPts: Pt[] = data.map((d, i) => ({ x: getX(i), y: getY(d.pemasukan) }));
  const pengeluaranPts: Pt[] = data.map((d, i) => ({ x: getX(i), y: getY(d.pengeluaran) }));
  const pemasukanLine = smoothPath(pemasukanPts);
  const pengeluaranLine = smoothPath(pengeluaranPts);

  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const masukDelta = last && prev ? deltaText(last.pemasukan, prev.pemasukan) : null;
  const keluarDelta = last && prev ? deltaText(last.pengeluaran, prev.pengeluaran) : null;

  if (data.length === 0) return null;

  return (
    <div className="w-full">
      {isEmpty ? (
        <div className="flex h-56 flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 text-center">
          <p className="text-sm font-medium text-slate-500">Belum ada data pada {periodText}</p>
          <p className="text-xs text-slate-400">Grafik akan muncul setelah ada transaksi kas.</p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Grafik tren keuangan ${periodText}`}
        >
          <defs>
            <linearGradient id="pemasukanFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="pengeluaranFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.14" />
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

          {/* Area halus di bawah garis */}
          <path
            d={`${pemasukanLine} L ${getX(data.length - 1).toFixed(2)} ${baselineY} L ${getX(0).toFixed(2)} ${baselineY} Z`}
            fill="url(#pemasukanFill)"
          />
          <path
            d={`${pengeluaranLine} L ${getX(data.length - 1).toFixed(2)} ${baselineY} L ${getX(0).toFixed(2)} ${baselineY} Z`}
            fill="url(#pengeluaranFill)"
          />

          {/* Garis tren */}
          <path
            d={pengeluaranLine}
            stroke="#ef4444"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={pemasukanLine}
            stroke="#16a34a"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Titik data + tooltip bawaan browser (nominal penuh) */}
          {data.map((d, i) => (
            <g key={`pts-${i}`}>
              <circle cx={getX(i)} cy={getY(d.pengeluaran)} r="4" fill="#ef4444" stroke="#fff" strokeWidth="2">
                <title>{`${d.label}: Pengeluaran Rp ${formatRupiah(d.pengeluaran)}`}</title>
              </circle>
              <circle cx={getX(i)} cy={getY(d.pemasukan)} r="4" fill="#16a34a" stroke="#fff" strokeWidth="2">
                <title>{`${d.label}: Pemasukan Rp ${formatRupiah(d.pemasukan)}`}</title>
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
        </svg>
      )}

      {/* Legenda tren (tanpa total agar tidak duplikat 3 kartu atas) */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
          Pemasukan
          {masukDelta && <span className="font-medium text-slate-400">({masukDelta})</span>}
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Pengeluaran
          {keluarDelta && <span className="font-medium text-slate-400">({keluarDelta})</span>}
        </span>
      </div>
    </div>
  );
}
