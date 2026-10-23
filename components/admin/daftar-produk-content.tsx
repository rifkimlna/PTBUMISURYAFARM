"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import type { DaftarProdukSnapshot } from "@/lib/daftar-produk-types";

/** Rupiah: negatif dalam kurung, null -> "—". */
function rp(v: number | null): string {
  if (v == null) return "—";
  const n = Math.round(Number(v) || 0);
  if (n < 0) return `(Rp ${formatRupiah(Math.abs(n))})`;
  return `Rp ${formatRupiah(n)}`;
}

/** Stok apa adanya (boleh 0/negatif), null -> "—". */
function stokFmt(v: number | null): string {
  if (v == null) return "—";
  return Math.round(Number(v) || 0).toLocaleString("id-ID");
}

export function DaftarProdukContent() {
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");
  const [data, setData] = useState<DaftarProdukSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuEkspor, setMenuEkspor] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  const queryFor = useCallback((cari: string) => {
    const q = new URLSearchParams();
    if (cari.trim()) q.set("cari", cari.trim());
    return q.toString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/keuangan/laporan/daftar-produk?${queryFor(applied)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as DaftarProdukSnapshot);
        } else {
          setError(j?.message || "Gagal memuat laporan Daftar Produk");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat laporan Daftar Produk");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, queryFor]);

  const tampilkan = () => setApplied(draft);

  const download = async (fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuEkspor(false);
    try {
      const res = await fetch(
        `/api/keuangan/laporan/daftar-produk?${queryFor(applied)}&format=${fmt}`,
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
      a.download = m?.[1] ?? `daftar-produk.${fmt}`;
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

  return (
    <div className="space-y-5">
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-sm">Filter Laporan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2 xl:col-span-2">
              <label htmlFor="dp-cari" className="mb-1.5 block text-xs font-medium text-slate-600">
                Cari produk
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="dp-cari"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      tampilkan();
                    }
                  }}
                  placeholder="Cari nama produk, kode/SKU, atau barcode"
                  className="h-10 pl-9 text-sm"
                />
              </div>
            </div>
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-2">
              <Button
                type="button"
                onClick={tampilkan}
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
        </CardContent>
      </Card>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <Card className="border-slate-200">
        <CardContent className="p-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
              <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
              <p className="text-sm font-semibold text-slate-900">LAPORAN DAFTAR PRODUK</p>
              <p className="text-xs text-slate-500">{data?.label ?? "—"}</p>
              <p className="text-xs text-slate-400">(harga dalam IDR)</p>
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-400">Memuat laporan...</p>
            ) : baris.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">Tidak ada produk yang cocok</p>
                <p className="mt-1 text-xs text-slate-500">
                  Ubah kata kunci pencarian, atau pastikan master Produk sudah terisi.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table className="min-w-[940px]">
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="min-w-[120px] whitespace-nowrap text-xs">Kode/SKU</TableHead>
                      <TableHead className="min-w-[220px] whitespace-nowrap text-xs">Nama Produk</TableHead>
                      <TableHead className="min-w-[90px] whitespace-nowrap text-xs">Satuan</TableHead>
                      <TableHead className="min-w-[100px] whitespace-nowrap text-right text-xs">Total Stok</TableHead>
                      <TableHead className="min-w-[110px] whitespace-nowrap text-right text-xs">Batas Minimum</TableHead>
                      <TableHead className="min-w-[150px] whitespace-nowrap text-right text-xs">Harga Beli</TableHead>
                      <TableHead className="min-w-[150px] whitespace-nowrap text-right text-xs">Harga Jual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baris.map((b, i) => (
                      <TableRow key={`${b.kode}::${i}`}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{b.kode}</TableCell>
                        <TableCell className="max-w-[320px] truncate whitespace-nowrap text-xs text-slate-700" title={b.namaProduk}>
                          {b.namaProduk}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{b.satuan || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-900">
                          {stokFmt(b.totalStok)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {b.totalStok == null ? "—" : stokFmt(b.batasMinimum)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp(b.hargaBeli)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {rp(b.hargaJual)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && baris.length > 0 && (
              <p className="text-xs text-slate-400">
                Menampilkan {baris.length} produk{applied.trim() ? ` untuk pencarian "${applied.trim()}"` : ""}.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-400">
        <Download className="h-3.5 w-3.5 shrink-0" />
        Tabel, PDF, dan XLSX memakai sumber data laporan yang sama sehingga angkanya identik. Stok dihitung dari stok awal + mutasi (masuk − keluar) tanpa pembagian gudang; nilai 0/negatif ditampilkan apa adanya.
      </p>
    </div>
  );
}
