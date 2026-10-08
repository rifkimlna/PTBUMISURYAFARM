"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  JUAL_PER_PELANGGAN_PERIODE_LABEL,
  rentangUntukJualPerPelanggan,
  type JualPerPelangganPeriode,
  type JualPerPelangganSnapshot,
} from "@/lib/jual-per-pelanggan-types";

type Draft = { periode: JualPerPelangganPeriode; dari: string; sampai: string };

const PERIODE_OPTIONS = (Object.keys(JUAL_PER_PELANGGAN_PERIODE_LABEL) as JualPerPelangganPeriode[]).map((v) => ({
  value: v,
  label: JUAL_PER_PELANGGAN_PERIODE_LABEL[v],
}));

const GRUP_PER_HALAMAN = 10;

function rp(v: number) {
  const n = Math.round(Number(v) || 0);
  if (n < 0) return `(Rp ${formatRupiah(Math.abs(n))})`;
  return `Rp ${formatRupiah(n)}`;
}
function fmtTgl(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function fmtQty(q: number) {
  return Number(q ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function JualPerPelangganContent() {
  const [draft, setDraft] = useState<Draft>(() => {
    const r = rentangUntukJualPerPelanggan("hari-ini")!;
    return { periode: "hari-ini", dari: r.dari, sampai: r.sampai };
  });
  const [applied, setApplied] = useState<Draft>(() => {
    const r = rentangUntukJualPerPelanggan("hari-ini")!;
    return { periode: "hari-ini", dari: r.dari, sampai: r.sampai };
  });
  const [data, setData] = useState<JualPerPelangganSnapshot | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [menuEkspor, setMenuEkspor] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  const queryFor = useCallback((f: Draft) => {
    const q = new URLSearchParams({ periode: f.periode, dari: f.dari, sampai: f.sampai });
    return q.toString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/keuangan/laporan/penjualan-per-pelanggan?${queryFor(applied)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as JualPerPelangganSnapshot);
          setPage(1);
        } else {
          setError(j?.message || "Gagal memuat Penjualan per Pelanggan");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat Penjualan per Pelanggan");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, queryFor]);

  // Memilih periode otomatis mengisi tanggal awal/akhir; Custom bebas diisi manual.
  const gantiPeriode = (v: JualPerPelangganPeriode) => {
    setFilterError("");
    const r = rentangUntukJualPerPelanggan(v);
    setDraft((d) => (r ? { periode: v, dari: r.dari, sampai: r.sampai } : { ...d, periode: v }));
  };

  const tampilkan = () => {
    if (!draft.dari || !draft.sampai) {
      setFilterError("Isi tanggal awal dan tanggal akhir terlebih dahulu");
      return;
    }
    if (new Date(draft.sampai) < new Date(draft.dari)) {
      setFilterError("Tanggal akhir tidak boleh lebih awal dari tanggal awal");
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
        `/api/keuangan/laporan/penjualan-per-pelanggan?${queryFor(applied)}&format=${fmt}`,
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
      a.download = m?.[1] ?? `penjualan-per-pelanggan.${fmt}`;
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
  const totalPages = Math.max(1, Math.ceil(grup.length / GRUP_PER_HALAMAN));
  const halaman = Math.min(page, totalPages);
  const grupTampil = grup.slice((halaman - 1) * GRUP_PER_HALAMAN, halaman * GRUP_PER_HALAMAN);
  const from = grup.length === 0 ? 0 : (halaman - 1) * GRUP_PER_HALAMAN + 1;
  const to = Math.min(halaman * GRUP_PER_HALAMAN, grup.length);
  const nomorHalaman = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - halaman) <= 1
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
              <label htmlFor="jp-dari" className="mb-1.5 block text-xs font-medium text-slate-600">
                Tanggal awal
              </label>
              <Input
                id="jp-dari"
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
              <label htmlFor="jp-sampai" className="mb-1.5 block text-xs font-medium text-slate-600">
                Tanggal akhir
              </label>
              <Input
                id="jp-sampai"
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
              <label htmlFor="jp-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
                Periode
              </label>
              <Select
                id="jp-periode"
                value={draft.periode}
                onChange={(e) => gantiPeriode(e.target.value as JualPerPelangganPeriode)}
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
                onClick={tampilkan}
                className="w-full cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
              >
                Tampilkan
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
              <p className="text-sm font-semibold text-slate-900">Penjualan per Pelanggan</p>
              <p className="text-xs text-slate-500">{data?.label ?? "—"}</p>
              <p className="text-xs text-slate-400">(dalam IDR)</p>
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-400">Memuat laporan...</p>
            ) : grup.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">Laporan akan muncul di sini</p>
                <p className="mt-1 text-xs text-slate-500">
                  Pilih tanggal atau periode, lalu klik tombol Tampilkan.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">Pelanggan / Tanggal</TableHead>
                      <TableHead className="text-xs">Tipe transaksi</TableHead>
                      <TableHead className="text-xs">No. transaksi</TableHead>
                      <TableHead className="text-xs">Nama produk</TableHead>
                      <TableHead className="text-xs">Keterangan</TableHead>
                      <TableHead className="text-right text-xs">Qty</TableHead>
                      <TableHead className="text-xs">Unit</TableHead>
                      <TableHead className="text-right text-xs">Harga per unit</TableHead>
                      <TableHead className="text-right text-xs">Nominal tagihan</TableHead>
                      <TableHead className="text-right text-xs">Total nominal tagihan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupTampil.map((g) => (
                      <Fragment key={g.pelanggan}>
                        <TableRow className="bg-slate-50/70">
                          <TableCell colSpan={10} className="text-xs font-semibold uppercase text-slate-900">
                            {g.pelanggan}
                          </TableCell>
                        </TableRow>
                        {g.baris.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="whitespace-nowrap text-xs text-slate-500">
                              {fmtTgl(b.tanggal)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-slate-600">
                              {b.tipeTransaksi}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-[11px] text-slate-600">
                              {b.noTransaksi}
                            </TableCell>
                            <TableCell className="text-xs text-slate-700">{b.produk}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-slate-500">
                              {b.keterangan}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                              {fmtQty(b.qty)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-slate-500">{b.unit}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                              {rp(b.harga)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                              {rp(b.nominal)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                              {rp(b.totalTagihan)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-slate-50/50">
                          <TableCell colSpan={9} className="text-xs font-semibold text-slate-900">
                            {g.pelanggan.toUpperCase()} | Total Penjualan
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                            {rp(g.subtotal)}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    ))}
                    <TableRow className="bg-emerald-700">
                      <TableCell colSpan={9} className="text-xs font-semibold text-white">
                        GRAND TOTAL
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {rp(data?.grandTotal ?? 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && grup.length > GRUP_PER_HALAMAN && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-slate-400">
                  Menampilkan {from}-{to} dari {grup.length} data
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={halaman <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
                  </Button>
                  {nomorHalaman.map((n, i, arr) => (
                    <span key={n} className="flex items-center gap-1">
                      {i > 0 && n - arr[i - 1] > 1 && <span className="text-xs text-slate-300">…</span>}
                      <Button
                        variant={n === halaman ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(n)}
                        className={`h-8 w-8 p-0 cursor-pointer ${n === halaman ? "bg-emerald-700 hover:bg-emerald-800" : ""}`}
                      >
                        {n}
                      </Button>
                    </span>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={halaman >= totalPages}
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
        Tabel, PDF, dan XLSX memakai sumber data Penjualan per Pelanggan yang sama sehingga angkanya identik.
      </p>
    </div>
  );
}
