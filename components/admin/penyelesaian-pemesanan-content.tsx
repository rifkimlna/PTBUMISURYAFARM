"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  PENYELESAIAN_PERIODE_LABEL,
  rentangUntukPenyelesaian,
  type PenyelesaianPeriode,
  type PenyelesaianSnapshot,
  type StatusPemesanan,
} from "@/lib/penyelesaian-pemesanan-types";

type Draft = { periode: PenyelesaianPeriode; dari: string; sampai: string };

const PERIODE_OPTIONS = (Object.keys(PENYELESAIAN_PERIODE_LABEL) as PenyelesaianPeriode[]).map((v) => ({
  value: v,
  label: PENYELESAIAN_PERIODE_LABEL[v],
}));

const LIMIT = 10;

function rp(v: number) {
  const n = Math.round(Number(v) || 0);
  if (n < 0) return `(Rp ${formatRupiah(Math.abs(n))})`;
  return `Rp ${formatRupiah(n)}`;
}
function fmtTgl(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function statusVariant(s: StatusPemesanan): "success" | "sehat" | "destructive" | "outline" {
  if (s === "Selesai") return "success";
  if (s === "Diproses") return "sehat";
  if (s === "Dibatalkan") return "destructive";
  return "outline";
}

export function PenyelesaianPemesananContent() {
  const [draft, setDraft] = useState<Draft>(() => {
    const r = rentangUntukPenyelesaian("hari-ini")!;
    return { periode: "hari-ini", dari: r.dari, sampai: r.sampai };
  });
  const [applied, setApplied] = useState<Draft>(() => {
    const r = rentangUntukPenyelesaian("hari-ini")!;
    return { periode: "hari-ini", dari: r.dari, sampai: r.sampai };
  });
  const [data, setData] = useState<PenyelesaianSnapshot | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [menuEkspor, setMenuEkspor] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  const queryFor = useCallback((f: Draft, p: number) => {
    const q = new URLSearchParams({
      periode: f.periode,
      dari: f.dari,
      sampai: f.sampai,
      page: String(p),
      limit: String(LIMIT),
    });
    return q.toString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/keuangan/laporan/penyelesaian-pemesanan?${queryFor(applied, page)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as PenyelesaianSnapshot);
          const pg = j.data?.pagination;
          if (pg) setTotalPages(Math.max(1, pg.totalPages ?? 1));
        } else {
          setError(j?.message || "Gagal memuat Penyelesaian Pemesanan");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat Penyelesaian Pemesanan");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, page, queryFor]);

  // Memilih periode otomatis mengisi tanggal awal/akhir; Custom bebas diisi manual.
  const gantiPeriode = (v: PenyelesaianPeriode) => {
    setFilterError("");
    const r = rentangUntukPenyelesaian(v);
    setDraft((d) => (r ? { periode: v, dari: r.dari, sampai: r.sampai } : { ...d, periode: v }));
  };

  const terapkanFilter = () => {
    if (!draft.dari || !draft.sampai) {
      setFilterError("Isi tanggal awal dan tanggal akhir terlebih dahulu");
      return;
    }
    if (new Date(draft.sampai) < new Date(draft.dari)) {
      setFilterError("Tanggal akhir tidak boleh lebih awal dari tanggal awal");
      return;
    }
    setFilterError("");
    setPage(1);
    setApplied(draft);
  };

  const download = async (fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuEkspor(false);
    try {
      const res = await fetch(
        `/api/keuangan/laporan/penyelesaian-pemesanan?${queryFor(applied, 1)}&format=${fmt}`,
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
      a.download = m?.[1] ?? `penyelesaian-pemesanan.${fmt}`;
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

  const baris = data?.baris ?? [];
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to = Math.min(page * LIMIT, total);
  const halaman = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1
  );

  return (
    <div className="space-y-5">
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-sm">Filter Laporan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label htmlFor="pp-dari" className="mb-1.5 block text-xs font-medium text-slate-600">
                Tanggal awal
              </label>
              <Input
                id="pp-dari"
                type="date"
                value={draft.dari}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, dari: e.target.value, periode: "custom" }));
                  setFilterError("");
                }}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label htmlFor="pp-sampai" className="mb-1.5 block text-xs font-medium text-slate-600">
                Tanggal akhir
              </label>
              <Input
                id="pp-sampai"
                type="date"
                value={draft.sampai}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, sampai: e.target.value, periode: "custom" }));
                  setFilterError("");
                }}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label htmlFor="pp-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
                Periode
              </label>
              <Select
                id="pp-periode"
                value={draft.periode}
                onChange={(e) => gantiPeriode(e.target.value as PenyelesaianPeriode)}
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
              <p className="text-sm font-semibold text-slate-900">PENYELESAIAN PEMESANAN PENJUALAN</p>
              <p className="text-xs text-slate-500">{data?.label ?? "—"}</p>
              <p className="text-xs text-slate-400">(dalam IDR)</p>
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-400">Memuat laporan...</p>
            ) : baris.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">Laporan akan muncul di sini</p>
                <p className="mt-1 text-xs text-slate-500">
                  Pilih tanggal atau periode, lalu klik tombol Filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">Tanggal Pemesanan</TableHead>
                      <TableHead className="text-xs">No. Pemesanan</TableHead>
                      <TableHead className="text-right text-xs">Jumlah Pemesanan</TableHead>
                      <TableHead className="text-xs">Status Pemesanan</TableHead>
                      <TableHead className="text-right text-xs">Jumlah Pengiriman</TableHead>
                      <TableHead className="text-right text-xs">Jumlah Faktur</TableHead>
                      <TableHead className="text-right text-xs">Jumlah Pembayaran</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baris.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">
                          {fmtTgl(b.tanggal)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-[11px] text-slate-600">
                          {b.noPemesanan}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp(b.jumlahPemesanan)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(b.status)} className="whitespace-nowrap text-[11px]">
                            {b.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp(b.jumlahPengiriman)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp(b.jumlahFaktur)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp(b.jumlahPembayaran)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50/70">
                      <TableCell colSpan={2} className="text-xs font-semibold text-slate-900">
                        TOTAL
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                        {rp(data?.totalPemesanan ?? 0)}
                      </TableCell>
                      <TableCell />
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                        {rp(data?.totalPengiriman ?? 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                        {rp(data?.totalFaktur ?? 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                        {rp(data?.totalPembayaran ?? 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && baris.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-slate-400">
                  Menampilkan {from}-{to} dari {total} data
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
                  </Button>
                  {halaman.map((n, i, arr) => (
                    <span key={n} className="flex items-center gap-1">
                      {i > 0 && n - arr[i - 1] > 1 && <span className="text-xs text-slate-300">…</span>}
                      <Button
                        variant={n === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(n)}
                        className={`h-8 w-8 p-0 cursor-pointer ${n === page ? "bg-emerald-700 hover:bg-emerald-800" : ""}`}
                      >
                        {n}
                      </Button>
                    </span>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="cursor-pointer"
                  >
                    Berikutnya <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-400">
        <Download className="h-3.5 w-3.5 shrink-0" />
        Tabel, PDF, dan XLSX memakai sumber data Penyelesaian Pemesanan yang sama sehingga angkanya identik.
      </p>
    </div>
  );
}
