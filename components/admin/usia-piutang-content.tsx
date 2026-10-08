"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  USIA_PIUTANG_PERIODE_LABEL,
  akhirUntukUsia,
  type UsiaPiutangPeriode,
  type UsiaPiutangSnapshot,
} from "@/lib/usia-piutang-types";

type Draft = { periode: UsiaPiutangPeriode; tanggal: string };

const PERIODE_OPTIONS = (Object.keys(USIA_PIUTANG_PERIODE_LABEL) as UsiaPiutangPeriode[]).map((v) => ({
  value: v,
  label: USIA_PIUTANG_PERIODE_LABEL[v],
}));

function todayYMD() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rp(v: number) {
  const n = Math.round(Number(v) || 0);
  if (n < 0) return `(Rp ${formatRupiah(Math.abs(n))})`;
  return `Rp ${formatRupiah(n)}`;
}

export function UsiaPiutangContent() {
  const [draft, setDraft] = useState<Draft>({ periode: "hari-ini", tanggal: todayYMD() });
  const [applied, setApplied] = useState<Draft>({ periode: "hari-ini", tanggal: todayYMD() });
  const [data, setData] = useState<UsiaPiutangSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [menuEkspor, setMenuEkspor] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  const queryFor = useCallback((f: Draft) => {
    const q = new URLSearchParams({ periode: f.periode, tanggal: f.tanggal });
    return q.toString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/keuangan/laporan/usia-piutang?${queryFor(applied)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as UsiaPiutangSnapshot);
        } else {
          setError(j?.message || "Gagal memuat Usia Piutang");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat Usia Piutang");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, queryFor]);

  // Memilih periode otomatis mengisi tanggal laporan; Custom bebas diisi manual.
  const gantiPeriode = (v: UsiaPiutangPeriode) => {
    setFilterError("");
    if (v === "custom") {
      setDraft((d) => ({ ...d, periode: v }));
      return;
    }
    setDraft({ periode: v, tanggal: toYMD(akhirUntukUsia(v)) });
  };

  const terapkanFilter = () => {
    if (!draft.tanggal) {
      setFilterError("Isi tanggal laporan terlebih dahulu");
      return;
    }
    setFilterError("");
    setApplied(draft);
  };

  const download = async (fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuEkspor(false);
    try {
      const res = await fetch(
        `/api/keuangan/laporan/usia-piutang?${queryFor(applied)}&format=${fmt}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || "Gagal mengunduh file");
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = m?.[1] ?? `usia-piutang.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunduh file");
    } finally {
      setDl(null);
    }
  };

  const grup = data?.grup ?? [];

  return (
    <div className="space-y-5">
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-sm">Filter Laporan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label htmlFor="up-tanggal" className="mb-1.5 block text-xs font-medium text-slate-600">
                Tanggal laporan
              </label>
              <Input
                id="up-tanggal"
                type="date"
                value={draft.tanggal}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, tanggal: e.target.value, periode: "custom" }));
                  setFilterError("");
                }}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label htmlFor="up-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
                Periode
              </label>
              <Select
                id="up-periode"
                value={draft.periode}
                onChange={(e) => gantiPeriode(e.target.value as UsiaPiutangPeriode)}
                aria-label="Periode"
              >
                {PERIODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                onClick={terapkanFilter}
                className="w-full cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
              >
                Filter
              </Button>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMenuEkspor((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuEkspor}
                  className="cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Ekspor
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {menuEkspor && (
                  <>
                    <button
                      type="button"
                      aria-label="Tutup menu ekspor"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setMenuEkspor(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={dl !== null}
                        onClick={() => download("pdf")}
                        className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <FileText className="h-4 w-4 text-slate-400" />
                        {dl === "pdf" ? "Menyiapkan PDF..." : "Download PDF"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={dl !== null}
                        onClick={() => download("xlsx")}
                        className="flex w-full cursor-pointer items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                        {dl === "xlsx" ? "Menyiapkan XLSX..." : "Download XLSX"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {filterError && <p className="text-xs text-red-600">{filterError}</p>}
        </CardContent>
      </Card>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <Card className="border-slate-200">
        <CardContent className="p-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
              <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
              <p className="text-sm font-semibold text-slate-900">Laporan Piutang Pelanggan</p>
              <p className="text-xs text-slate-500">{data?.label ?? "—"}</p>
              <p className="text-xs text-slate-400">(dalam IDR)</p>
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-400">Memuat laporan...</p>
            ) : grup.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">Anda belum memiliki data.</p>
                <p className="mt-1 text-xs text-slate-500">Data transaksi anda akan muncul di sini</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-right text-xs">Total</TableHead>
                      <TableHead className="text-right text-xs">1 - 30 Hari</TableHead>
                      <TableHead className="text-right text-xs">31 - 60 Hari</TableHead>
                      <TableHead className="text-right text-xs">61 - 90 Hari</TableHead>
                      <TableHead className="text-right text-xs">&gt; 90 Hari</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grup.map((g) => (
                      <TableRow key={g.pelanggan}>
                        <TableCell className="text-xs font-medium text-slate-900">{g.pelanggan}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                          {rp(g.total)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp(g.b1)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp(g.b2)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp(g.b3)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp(g.b4)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-emerald-700">
                      <TableCell className="text-xs font-semibold text-white">Total Piutang</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {rp(data?.total ?? 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {rp(data?.totalB1 ?? 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {rp(data?.totalB2 ?? 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {rp(data?.totalB3 ?? 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {rp(data?.totalB4 ?? 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-400">
        <Download className="h-3.5 w-3.5 shrink-0" />
        Tabel, PDF, dan XLSX memakai sumber data Usia Piutang yang sama sehingga angkanya identik.
      </p>
    </div>
  );
}
