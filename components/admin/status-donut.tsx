"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Item = { key: string; label: string; value: number; total: number };

const STATUS_COLOR: Record<string, string> = {
  SEHAT: "#16a34a",
  PERLU_PERHATIAN: "#f59e0b",
  SAKIT: "#ef4444",
  MATI: "#64748b",
};
const STATUS_LABEL: Record<string, string> = {
  SEHAT: "Sehat",
  PERLU_PERHATIAN: "Perlu Perhatian",
  SAKIT: "Sakit",
  MATI: "Mati",
};

export function StatusDonut() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/perkebunan/chart?type=status")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success) setItems(j.data.items);
        else setError(j.message || "Gagal memuat status");
      })
      .catch(() => !cancelled && setError("Gagal memuat status"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const total = items.reduce((s, i) => s + i.value, 0);

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader><CardTitle className="text-sm">Status Pohon</CardTitle><p className="text-xs text-slate-500 mt-1">Sebaran kesehatan pohon</p></CardHeader>
        <CardContent><div className="flex h-[240px] items-center justify-center text-sm text-slate-400">Memuat...</div></CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="border-slate-200">
        <CardHeader><CardTitle className="text-sm">Status Pohon</CardTitle></CardHeader>
        <CardContent><div className="flex h-[240px] items-center justify-center text-sm text-red-600">{error}</div></CardContent>
      </Card>
    );
  }

  // Donut calc
  const size = 160;
  const thickness = 28;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm">Status Pohon</CardTitle>
        <p className="mt-1 text-xs text-slate-500">Sebaran kesehatan — {total} pohon</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="block -rotate-90">
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
              {items.map((item) => {
                if (total === 0 || item.value === 0) return null;
                const dash = (item.value / total) * circumference;
                const el = (
                  <circle
                    key={item.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={STATUS_COLOR[item.key] || "#94a3b8"}
                    strokeWidth={thickness}
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="round"
                  />
                );
                offset += dash;
                return el;
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-2xl font-semibold tracking-tight text-slate-900">{total}</div>
              <div className="text-xs text-slate-500">pohon</div>
            </div>
          </div>
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-1 gap-2.5 min-w-0">
            {items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLOR[item.key] || "#94a3b8" }} />
                  <span className="text-sm font-medium text-slate-700 truncate">{STATUS_LABEL[item.key] || item.key}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                  <span className="text-xs text-slate-500">({total ? Math.round((item.value / total) * 100) : 0}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
