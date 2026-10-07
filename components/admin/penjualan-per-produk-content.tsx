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
  PENJUALAN_PER_PRODUK_PERIODE_LABEL,
  awalUntukPeriode,
  akhirUntukPeriode,
  type PenjualanPerProdukPeriode,
  type PenjualanPerProdukSnapshot,
} from "@/lib/penjualan-per-produk-types";

type Draft = { periode: PenjualanPerProdukPeriode; tanggalAwal: string; tanggalAkhir: string };

const PERIODE_OPTIONS = (Object.keys(PENJUALAN_PER_PRODUK_PERIODE_LABEL) as PenjualanPerProdukPeriode[]).map((v) => ({
  value: v,
  label: PENJUALAN_PER_PRODUK_PERIODE_LABEL[v],
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

export function PenjualanPerProdukContent() {
  const [draft, setDraft] = useState<Draft>({
    periode: "hari-ini",
    tanggalAwal: todayYMD(),
    tanggalAkhir: todayYMD(),
  });
  const [applied, setApplied] = useState<Draft>({
    periode: "hari-ini",
    tanggalAwal: todayYMD(),
    tanggalAkhir: todayYMD(),
  });
  const [data, setData] = useState<PenjualanPerProdukSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [menuEkspor, setMenuEkspor] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  const queryFor = useCallback((f: Draft) => {
    const q = new URLSearchParams({
      periode: f.periode,
      tanggalAwal: f.tanggalAwal,
      tanggalAkhir: f.tanggalAkhir,
    });
    return q.toString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/keuangan/laporan/penjualan-per-produk?${queryFor(applied)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as PenjualanPerProdukSnapshot);
        } else {
          setError(j?.message || "Gagal memuat laporan Penjualan per Produk");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat laporan Penjualan per Produk");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, queryFor]);

  const gantiPeriode = (v: PenjualanPerProdukPeriode) => {
    setFilterError("");
    if (v === "custom") {
      setDraft((d) => ({ ...d, periode: v }));
      return;
    }
    setDraft({
      periode: v,
      tanggalAwal: toYMD(awalUntukPeriode(v)),
      tanggalAkhir: toYMD(akhirUntukPeriode(v)),
    });
  };

  const terapkanFilter = () => {
    if (!draft.tanggalAwal || !draft.tanggalAkhir) {
      setFilterError("Isi tanggal awal dan akhir terlebih dahulu");
      return;
    }
    const awal = new Date(draft.tanggalAwal);
    const akhir = new Date(draft.tanggalAkhir);
    if (awal > akhir) {
      setFilterError("Tanggal awal tidak boleh lebih besar dari tanggal akhir");
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
        `/api/keuangan/laporan/penjualan-per-produk?${queryFor(applied)}&format=${fmt}`,
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
      a.download = m?.[1] ?? `penjualan-per-produk.${fmt}`;
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
            <div>
              <label htmlFor="pp-tanggal-awal" className="mb-1.5 block text-xs font-medium text-slate-600">
                Tanggal awal
              </label>
              <Input
                id="pp-tanggal-awal"
                type="date"
                value={draft.tanggalAwal}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, tanggalAwal: e.target.value, periode: "custom" }));
                  setFilterError("");
                }}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label htmlFor="pp-tanggal-akhir" className="mb-1.5 block text-xs font-medium text-slate-600">
                Tanggal akhir
              </label>
              <Input
                id="pp-tanggal-akhir"
                type="date"
                value={draft.tanggalAkhir}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, tanggalAkhir: e.target.value, periode: "custom" }));
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
                onChange={(e) => gantiPeriode(e.target.value as PenjualanPerProdukPeriode)}
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
              <p className="text-sm font-semibold text-slate-900">Penjualan per Produk</p>
              <p className="text-xs text-slate-500">{data?.label ?? "—"}</p>
              <p className="text-xs text-slate-400">(dalam IDR)</p>
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-400">Memuat laporan...</p>
            ) : baris.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">Laporan akan muncul di sini</p>
                <p className="mt-1 text-xs text-slate-500">Pilih tanggal atau periode, lalu klik tombol Tampilkan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="text-xs">Kode produk / SKU</TableHead>
                      <TableHead className="text-xs">Nama produk</TableHead>
                      <TableHead className="text-right text-xs">Qty penjualan</TableHead>
                      <TableHead className="text-right text-xs">Qty retur</TableHead>
                      <TableHead className="text-xs">Unit</TableHead>
                      <TableHead className="text-right text-xs">Nilai penjualan</TableHead>
                      <TableHead className="text-right text-xs">Nilai retur</TableHead>
                      <TableHead className="text-right text-xs">Nilai penjualan rata-rata</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baris.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="text-xs">{b.kodeProduk}</TableCell>
                        <TableCell className="text-xs">{b.namaProduk}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {b.qtyPenjualan}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                          {b.qtyRetur}
                        </TableCell>
                        <TableCell className="text-xs">{b.unit}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-900">
                          {rp(b.nilaiPenjualan)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-900">
                          {rp(b.nilaiRetur)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-900">
                          {rp(b.hargaRataRata)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-emerald-700">
                      <TableCell className="text-xs font-semibold text-white">TOTAL</TableCell>
                      <TableCell className="text-xs font-semibold text-white"></TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white"></TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white"></TableCell>
                      <TableCell className="text-xs font-semibold text-white"></TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {rp(data?.totalNilaiPenjualan ?? 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {rp(data?.totalNilaiRetur ?? 0)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {/* Harga rata-rata total tidak diperlukan, biarkan kosong */}
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
        Tabel, PDF, dan XLSX memakai sumber data laporan yang sama sehingga angkanya identik.
      </p>
    </div>
  );
}
