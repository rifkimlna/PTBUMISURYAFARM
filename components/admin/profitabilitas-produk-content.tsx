"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, SlidersHorizontal } from "lucide-react";
import {
  labelRentang,
  todayYMDLokal,
  type ProfitabilitasSnapshot,
} from "@/lib/profitabilitas-produk-types";

type Draft = { dari: string; sampai: string; produk: string; kategori: string };

const LIMIT = 25;

/** Rupiah layar gaya Mekari: "Rp. 35.000,00", negatif dalam kurung. */
function rp2(v: number): string {
  const n = Math.round(Number(v) * 100) / 100 || 0;
  const abs = Math.abs(n);
  const bulat = Math.floor(abs);
  const sen = Math.round((abs - bulat) * 100);
  const ribuan = String(bulat).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const teks = `Rp. ${ribuan},${String(sen).padStart(2, "0")}`;
  return n < 0 ? `(${teks})` : teks;
}

/** Margin persen gaya Indonesia: 100 -> "100%", 33.33 -> "33,3%". */
function margin(v: number): string {
  const b = Math.round(Number(v) * 10) / 10;
  const s = Number.isInteger(b) ? String(b) : String(b).replace(".", ",");
  return `${s}%`;
}

function qtyFmt(v: number): string {
  const b = Math.round(Number(v) * 100) / 100;
  return b.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function ProfitabilitasProdukContent() {
  const [draft, setDraft] = useState<Draft>({ dari: todayYMDLokal(), sampai: todayYMDLokal(), produk: "", kategori: "" });
  const [applied, setApplied] = useState<Draft>({ dari: todayYMDLokal(), sampai: todayYMDLokal(), produk: "", kategori: "" });
  const [showFilter, setShowFilter] = useState(false);
  const [kategoriList, setKategoriList] = useState<string[]>([]);
  const [data, setData] = useState<ProfitabilitasSnapshot | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [menuEkspor, setMenuEkspor] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/persediaan/kategori", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (cancelled) return;
        const arr = j?.success && Array.isArray(j.data) ? j.data : [];
        setKategoriList(arr.map((k: { kategori: string }) => k.kategori).filter(Boolean));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const queryFor = useCallback((f: Draft, p: number) => {
    const q = new URLSearchParams({
      dari: f.dari,
      sampai: f.sampai,
      page: String(p),
      limit: String(LIMIT),
    });
    if (f.produk.trim()) q.set("produk", f.produk.trim());
    if (f.kategori) q.set("kategori", f.kategori);
    return q.toString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/keuangan/laporan/profitabilitas-produk?${queryFor(applied, page)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as ProfitabilitasSnapshot);
          const pg = j.data?.pagination;
          if (pg) setTotalPages(Math.max(1, pg.totalPages ?? 1));
        } else {
          setError(j?.message || "Gagal memuat Profitabilitas Produk");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat Profitabilitas Produk");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, page, queryFor]);

  const validasiTanggal = (): boolean => {
    if (!draft.dari || !draft.sampai) {
      setFilterError("Isi tanggal awal dan tanggal akhir terlebih dahulu");
      return false;
    }
    if (new Date(draft.sampai) < new Date(draft.dari)) {
      setFilterError("Tanggal akhir tidak boleh lebih awal dari tanggal awal");
      return false;
    }
    setFilterError("");
    return true;
  };

  const tampilkan = () => {
    if (!validasiTanggal()) return;
    setPage(1);
    setApplied(draft);
  };

  const terapkanFilterLanjutan = () => {
    if (!validasiTanggal()) return;
    setPage(1);
    setApplied(draft);
  };

  const download = async (fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuEkspor(false);
    try {
      const res = await fetch(
        `/api/keuangan/laporan/profitabilitas-produk?${queryFor(applied, 1)}&format=${fmt}`,
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
      a.download = m?.[1] ?? `profitabilitas-produk.${fmt}`;
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
                  setDraft((d) => ({ ...d, dari: e.target.value }));
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
                  setDraft((d) => ({ ...d, sampai: e.target.value }));
                  setFilterError("");
                }}
                className="h-10 text-sm"
              />
            </div>
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-2">
              <Button
                type="button"
                onClick={tampilkan}
                className="w-full cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
              >
                Filter
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilter((v) => !v)}
                aria-expanded={showFilter}
                className="cursor-pointer"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filter
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilter ? "rotate-180" : ""}`} />
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
          {showFilter && (
            <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 md:grid-cols-3">
              <div>
                <label htmlFor="pp-produk" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Produk
                </label>
                <Input
                  id="pp-produk"
                  value={draft.produk}
                  onChange={(e) => setDraft((d) => ({ ...d, produk: e.target.value }))}
                  placeholder="Cari nama produk..."
                  className="h-10 bg-white text-sm"
                />
              </div>
              <div>
                <label htmlFor="pp-kategori" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Kategori produk
                </label>
                <Select
                  id="pp-kategori"
                  value={draft.kategori}
                  onChange={(e) => setDraft((d) => ({ ...d, kategori: e.target.value }))}
                  className="h-10 bg-white text-sm"
                  aria-label="Kategori produk"
                >
                  <option value="">Semua kategori</option>
                  {kategoriList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={terapkanFilterLanjutan} className="w-full cursor-pointer">
                  Terapkan
                </Button>
              </div>
            </div>
          )}
          {filterError && <p className="text-xs text-red-600">{filterError}</p>}
        </CardContent>
      </Card>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <Card className="border-slate-200">
        <CardContent className="p-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
              <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
              <p className="text-sm font-semibold text-slate-900">LAPORAN PROFITABILITAS PRODUK</p>
              <p className="text-xs text-slate-500">{data ? labelRentang(applied.dari, applied.sampai) : "—"}</p>
              <p className="text-xs text-slate-400">(dalam IDR)</p>
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-400">Memuat laporan...</p>
            ) : baris.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">Laporan akan muncul di sini</p>
                <p className="mt-1 text-xs text-slate-500">
                  Silakan pilih tanggal, lalu klik tombol Filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table className="min-w-[1320px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="min-w-[220px] whitespace-nowrap text-xs">Nama Produk</TableHead>
                      <TableHead className="min-w-[100px] whitespace-nowrap text-right text-xs">Qty Terjual</TableHead>
                      <TableHead className="min-w-[80px] whitespace-nowrap text-xs">Satuan</TableHead>
                      <TableHead className="min-w-[170px] whitespace-nowrap text-right text-xs">Nilai Total Penjualan</TableHead>
                      <TableHead className="min-w-[150px] whitespace-nowrap text-right text-xs">Total HPP</TableHead>
                      <TableHead className="min-w-[160px] whitespace-nowrap text-right text-xs">Nilai Total Profit</TableHead>
                      <TableHead className="min-w-[120px] whitespace-nowrap text-right text-xs">Profit Margin (%)</TableHead>
                      <TableHead className="min-w-[170px] whitespace-nowrap text-right text-xs">Harga Jual Rata-rata</TableHead>
                      <TableHead className="min-w-[170px] whitespace-nowrap text-right text-xs">Harga Beli Rata-rata</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baris.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="max-w-[320px] truncate whitespace-nowrap text-xs text-slate-700" title={b.namaProduk}>
                          {b.namaProduk}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {qtyFmt(b.qtyTerjual)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">{b.satuan || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp2(b.nilaiPenjualan)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp2(b.totalHpp)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs font-medium tabular-nums text-slate-900">
                          {rp2(b.profit)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {margin(b.marginPersen)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp2(b.hargaJualRata)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp2(b.hargaBeliRata)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50/70">
                      <TableCell className="text-xs font-semibold text-slate-900">
                        TOTAL
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                        {qtyFmt(data?.totalQty ?? 0)}
                      </TableCell>
                      <TableCell />
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                        {rp2(data?.totalPenjualan ?? 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                        {rp2(data?.totalHpp ?? 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                        {rp2(data?.totalProfit ?? 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                        {margin(data?.marginTotalPersen ?? 0)}
                      </TableCell>
                      <TableCell />
                      <TableCell />
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
        Tabel, PDF, dan XLSX memakai sumber data Profitabilitas Produk yang sama sehingga angkanya identik.
        HPP diambil dari master Produk (harga beli, fallback harga satuan); item tanpa master HPP Rp 0.
      </p>
    </div>
  );
}
