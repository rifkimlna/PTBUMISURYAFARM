"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  DAFTAR_PENGELUARAN_PERIODE_LABEL,
  rentangUntukDaftarPengeluaran,
  type DaftarPengeluaranPeriode,
  type DaftarPengeluaranSnapshot,
} from "@/lib/daftar-pengeluaran-types";

// Tampilan ala Daftar Pembelian: kartu filter di atas, isi laporan langsung di
// bawahnya. Seluruh angka memakai snapshot dari API yang sama.

type ApiData = { mode: "single"; snapshot: DaftarPengeluaranSnapshot };

type Draft = { periode: DaftarPengeluaranPeriode; dari: string; sampai: string };

const PERIODE_OPTIONS = (Object.keys(DAFTAR_PENGELUARAN_PERIODE_LABEL) as DaftarPengeluaranPeriode[]).map((v) => ({
  value: v,
  label: DAFTAR_PENGELUARAN_PERIODE_LABEL[v],
}));

function todayYMD() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function rp(v: number) {
  const n = Math.round(Number(v) || 0);
  if (n < 0) return `(Rp ${formatRupiah(Math.abs(n))})`;
  return `Rp ${formatRupiah(n)}`;
}
function fmtTgl(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function SnapshotView({ s }: { s: DaftarPengeluaranSnapshot }) {
  if (s.jumlahTransaksi === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
          <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
          <p className="text-sm font-semibold text-slate-900">Daftar Pengeluaran</p>
          <p className="text-xs text-slate-500">{s.label}</p>
          <p className="text-xs text-slate-400">(dalam IDR)</p>
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">Tidak ada pengeluaran pada periode ini</p>
          <p className="mt-1 text-xs text-slate-400">Coba pilih periode lain atau persempit rentang tanggal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
        <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
        <p className="text-sm font-semibold text-slate-900">Daftar Pengeluaran</p>
        <p className="text-xs text-slate-500">{s.label}</p>
        <p className="text-xs text-slate-400">(dalam IDR)</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-xs">Tanggal</TableHead>
              <TableHead className="text-xs">Nomor</TableHead>
              <TableHead className="text-xs">Kategori</TableHead>
              <TableHead className="text-xs">Deskripsi</TableHead>
              <TableHead className="text-xs">Supplier</TableHead>
              <TableHead className="text-right text-xs">Jumlah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.baris.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="whitespace-nowrap text-xs text-slate-600">{fmtTgl(b.tanggal)}</TableCell>
                <TableCell className="whitespace-nowrap font-mono text-[11px] text-slate-500">{b.nomor ?? "—"}</TableCell>
                <TableCell className="text-xs text-slate-700">{b.kategori}</TableCell>
                <TableCell className="max-w-[22rem] truncate text-xs text-slate-500" title={b.deskripsi ?? ""}>
                  {b.deskripsi || <span className="text-slate-300">—</span>}
                </TableCell>
                <TableCell className="text-xs text-slate-500">{b.supplier || <span className="text-slate-300">—</span>}</TableCell>
                <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">{rp(b.jumlah)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-emerald-700 hover:bg-emerald-700">
              <TableCell colSpan={5} className="py-3 text-sm font-semibold text-white">
                Total Biaya ({s.jumlahTransaksi} transaksi)
              </TableCell>
              <TableCell className="py-3 text-right text-sm font-semibold tabular-nums text-white">
                {rp(s.grandTotal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {s.catatan.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800">Catatan</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-amber-800">
            {s.catatan.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function draftAwal(): Draft {
  const t = todayYMD();
  const r = rentangUntukDaftarPengeluaran("bulan-ini");
  return { periode: "bulan-ini", dari: r?.dari ?? t, sampai: r?.sampai ?? t };
}

export function DaftarPengeluaranContent() {
  const [draft, setDraft] = useState<Draft>(draftAwal);
  const [applied, setApplied] = useState<Draft>(draftAwal);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [menuUnduh, setMenuUnduh] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  const queryDaftar = useCallback(() => {
    const p = new URLSearchParams({ periode: applied.periode });
    if (applied.periode === "custom") {
      p.set("dari", applied.dari);
      p.set("sampai", applied.sampai);
    }
    return p.toString();
  }, [applied]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/keuangan/laporan/daftar-pengeluaran?${queryDaftar()}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as ApiData);
        } else {
          setError(j?.message || "Gagal memuat Daftar Pengeluaran");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat Daftar Pengeluaran");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryDaftar]);

  const gantiPeriode = (v: DaftarPengeluaranPeriode) => {
    setFilterError("");
    const r = rentangUntukDaftarPengeluaran(v);
    setDraft((d) => ({ ...d, periode: v, dari: r?.dari ?? d.dari, sampai: r?.sampai ?? d.sampai }));
  };

  const gantiTanggal = (key: "dari" | "sampai", value: string) => {
    const next = { ...draft, [key]: value, periode: "custom" as DaftarPengeluaranPeriode };
    if (next.dari && next.sampai && new Date(next.sampai) < new Date(next.dari)) {
      setFilterError("Tanggal akhir tidak boleh lebih awal dari tanggal mulai");
      return;
    }
    setFilterError("");
    setDraft(next);
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
    setLoading(true);
    setError("");
    setApplied({ ...draft });
  };

  const daftar: DaftarPengeluaranSnapshot[] = data?.mode === "single" ? [data.snapshot] : [];

  // Unduhan memakai query filter aktif yang sama dengan tampilan.
  const download = async (fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuUnduh(false);
    try {
      const res = await fetch(`/api/keuangan/laporan/daftar-pengeluaran?${queryDaftar()}&format=${fmt}`, {
        credentials: "include",
      });
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
      a.download = m?.[1] ?? `daftar-pengeluaran.${fmt}`;
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

  return (
    <div className="space-y-5">
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-sm">Filter Laporan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label htmlFor="dpg-dari" className="mb-1.5 block text-xs font-medium text-slate-600">
                Tanggal awal
              </label>
              <Input id="dpg-dari" type="date" value={draft.dari} onChange={(e) => gantiTanggal("dari", e.target.value)} className="h-10 text-sm" />
            </div>
            <div>
              <label htmlFor="dpg-sampai" className="mb-1.5 block text-xs font-medium text-slate-600">
                Tanggal akhir
              </label>
              <Input id="dpg-sampai" type="date" value={draft.sampai} onChange={(e) => gantiTanggal("sampai", e.target.value)} className="h-10 text-sm" />
            </div>
            <div>
              <label htmlFor="dpg-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
                Periode
              </label>
              <Select
                id="dpg-periode"
                value={draft.periode}
                onChange={(e) => gantiPeriode(e.target.value as DaftarPengeluaranPeriode)}
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
                  onClick={() => setMenuUnduh((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuUnduh}
                  className="cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Ekspor
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {menuUnduh && (
                  <>
                    <button
                      type="button"
                      aria-label="Tutup menu unduhan"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setMenuUnduh(false)}
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

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Memuat laporan...</p>
      ) : daftar.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 sm:p-6">
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">Tidak ada pengeluaran pada periode ini</p>
              <p className="mt-1 text-xs text-slate-500">
                Silakan pilih tanggal atau periode lain, lalu klik tombol Filter.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        daftar.map((s) => (
          <Card key={s.label} className="border-slate-200">
            <CardContent className="p-5 sm:p-6">
              <SnapshotView s={s} />
            </CardContent>
          </Card>
        ))
      )}

      <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-400">
        <Download className="h-3.5 w-3.5 shrink-0" />
        Tabel, PDF, dan XLSX memakai sumber data Daftar Pengeluaran yang sama sehingga angkanya identik.
      </p>
    </div>
  );
}
