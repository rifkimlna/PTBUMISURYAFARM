"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Item = { key: string; label: string; value: number; count: number };

function formatKg(n: number) {
  return `${n.toLocaleString("id-ID", { maximumFractionDigits: 1 })} KG`;
}

export function BarHasilBlok({ groupBy = "blok" }: { groupBy?: "blok" | "jenis" }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/perkebunan/chart?type=${groupBy}`)
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
  }, [groupBy]);

  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-sm">{groupBy === "blok" ? "Hasil per Blok" : "Hasil per Jenis"}</CardTitle>
        <p className="mt-1 text-xs text-slate-500">
          {groupBy === "blok" ? "Total KG per blok — urut tertinggi" : "Total KG per jenis pohon"}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-slate-400">Memuat...</div>
        ) : error ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-slate-400">Belum ada data hasil panen</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const pct = max ? (item.value / max) * 100 : 0;
              return (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{item.label}</div>
                      <div className="text-xs text-slate-500">{item.count} pohon</div>
                    </div>
                    <div className="text-sm font-semibold tracking-tight text-slate-900 shrink-0">{formatKg(item.value)}</div>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-700 transition-all"
                      style={{ width: `${pct}%`, minWidth: item.value > 0 ? 8 : 0 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
