"use client";

import { Fragment, Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  MonitorDot,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import type { AnggaranDetailSnapshot } from "@/lib/anggaran-laporan-server";

// Manajemen Anggaran — daftar anggaran asli + detail read-only + export.
// Buat/ubah nilai memakai halaman Anggaran Laba Rugi; hapus memakai API
// anggaran yang sudah tersedia (tidak ada backend baru).

type BudgetRow = {
  id: string;
  nama: string;
  tahunMulai: number;
  bulanMulai: number;
  durasi: number;
  updatedAt: string;
  createdBy: { nama: string } | null;
};

function labelPanjang(tahun: number, bulan: number) {
  return new Date(tahun, bulan - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function labelPeriode(b: BudgetRow) {
  const awal = labelPanjang(b.tahunMulai, b.bulanMulai);
  if (b.durasi <= 1) return awal;
  const idx = b.bulanMulai - 1 + b.durasi - 1;
  const akhir = labelPanjang(b.tahunMulai + Math.floor(idx / 12), (idx % 12) + 1);
  return `${awal} – ${akhir}`;
}

function fmtTgl(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function rp(v: number) {
  const n = Math.round(Number(v) || 0);
  if (n < 0) return `(Rp ${formatRupiah(Math.abs(n))})`;
  return `Rp ${formatRupiah(n)}`;
}

export function ManajemenAnggaranContent() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-slate-400">Memuat Manajemen Anggaran...</p>}>
      <ManajemenAnggaranIsi />
    </Suspense>
  );
}

function ManajemenAnggaranIsi() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramId = searchParams.get("id");

  const [budgets, setBudgets] = useState<BudgetRow[] | null>(null);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [snap, setSnap] = useState<AnggaranDetailSnapshot | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [menuUnduh, setMenuUnduh] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/keuangan/anggaran-laba-rugi", { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setBudgets(j.data as BudgetRow[]);
          setListError("");
        } else {
          setListError(j?.message || "Gagal memuat daftar anggaran");
        }
      })
      .catch(() => {
        if (!cancelled) setListError("Gagal memuat daftar anggaran");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const bukaDetail = useCallback(
    (id: string) => {
      setDetailId(id);
      setSnap(null);
      setDetailError("");
      setMenuUnduh(false);
      router.push(`${pathname}?id=${id}`, { scroll: false });
    },
    [pathname, router]
  );

  useEffect(() => {
    if (paramId && paramId !== detailId) {
      setDetailId(paramId);
      setSnap(null);
      setDetailError("");
    }
    if (!paramId && detailId) {
      setDetailId(null);
      setSnap(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramId]);

  useEffect(() => {
    if (!detailId) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    fetch(`/api/keuangan/laporan/anggaran-laporan?id=${detailId}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setSnap((j.data as { snapshot: AnggaranDetailSnapshot }).snapshot);
        } else {
          setDetailError(j?.message || "Gagal memuat detail anggaran");
        }
      })
      .catch(() => {
        if (!cancelled) setDetailError("Gagal memuat detail anggaran");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  const kembaliKeDaftar = () => {
    setDetailId(null);
    setSnap(null);
    setMenuUnduh(false);
    router.push(pathname, { scroll: false });
  };

  const hapus = async (id: string, label: string) => {
    if (!window.confirm(`Hapus anggaran "${label}"?`)) return;
    try {
      const res = await fetch(`/api/keuangan/anggaran-laba-rugi/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await res.json();
      if (!j?.success) throw new Error(j?.message || "Gagal menghapus anggaran");
      setReloadKey((k) => k + 1);
      if (detailId === id) kembaliKeDaftar();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Gagal menghapus anggaran");
    }
  };

  const download = async (fmt: "pdf" | "xlsx") => {
    if (!detailId) return;
    setDl(fmt);
    setMenuUnduh(false);
    try {
      const res = await fetch(`/api/keuangan/laporan/anggaran-laporan?id=${detailId}&format=${fmt}`, {
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
      a.download = m?.[1] ?? `anggaran.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Gagal mengunduh file");
    } finally {
      setDl(null);
    }
  };

  // ------------------------- DETAIL -------------------------
  if (detailId) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={kembaliKeDaftar} className="w-fit cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke daftar
          </Button>
          <div className="relative">
            <Button
              type="button"
              onClick={() => setMenuUnduh((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuUnduh}
              disabled={!snap}
              className="cursor-pointer bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download / Ekspor
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

        {detailLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Memuat detail anggaran...</p>
        ) : detailError ? (
          <p className="py-10 text-center text-sm text-red-600">{detailError}</p>
        ) : snap ? (
          <Card className="border-slate-200">
            <CardContent className="p-5 sm:p-6">
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
                  <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
                  <p className="text-sm font-semibold text-slate-900">{snap.nama}</p>
                  <p className="text-xs text-slate-500">{snap.label}</p>
                  <p className="text-xs text-slate-400">(dalam IDR)</p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="min-w-56 text-xs">Akun</TableHead>
                        {snap.bulan.map((b) => (
                          <TableHead key={`${b.tahun}-${b.bulan}`} className="min-w-32 text-right text-xs">
                            {b.label}
                          </TableHead>
                        ))}
                        <TableHead className="min-w-32 text-right text-xs">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <GrupRows judul="Revenue" akun={snap.revenue.akun} nBulan={snap.bulan.length} />
                      <GrupRows judul="Cost of Sales" akun={snap.cos.akun} nBulan={snap.bulan.length} />
                      <TotalRow text="Gross Profit" vals={snap.grossProfit.bulan} total={snap.grossProfit.total} />
                      <GrupRows judul="Operational Expense" akun={snap.opex.akun} nBulan={snap.bulan.length} />
                      <TotalRow text="Total dari Operational Expense" vals={snap.opexTotal.bulan} total={snap.opexTotal.total} />
                      <TotalRow text="Operating Profit" vals={snap.operatingProfit.bulan} total={snap.operatingProfit.total} />
                      <TableRow className="bg-slate-100/70">
                        <TableCell colSpan={snap.bulan.length + 2} className="text-xs font-bold uppercase tracking-wide text-slate-700">
                          Other Income (Expense)
                        </TableCell>
                      </TableRow>
                      <GrupRows judul="Other Income" akun={snap.otherIncome.akun} nBulan={snap.bulan.length} />
                      <GrupRows judul="Other Expense" akun={snap.otherExpense.akun} nBulan={snap.bulan.length} />
                      <TotalRow text="Total dari Other Income (Expense)" vals={snap.otherTotal.bulan} total={snap.otherTotal.total} />
                      <TotalRow text="Profit (Loss)" vals={snap.profit.bulan} total={snap.profit.total} grand />
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/keuangan/laporan/anggaran-laba-rugi?anggaran=${snap.id}&kelola=edit`)}
                    className="cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Ubah data
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/keuangan/laporan/anggaran-laba-rugi?anggaran=${snap.id}`)}
                    className="cursor-pointer"
                  >
                    <MonitorDot className="h-3.5 w-3.5" />
                    Pantau realisasi
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => hapus(snap.id, snap.nama)}
                    className="cursor-pointer text-red-600 hover:text-red-700"
                    aria-label={`Hapus ${snap.nama}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                </div>

                {snap.catatan.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold text-amber-800">Catatan</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-amber-800">
                      {snap.catatan.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-400">
          <Download className="h-3.5 w-3.5 shrink-0" />
          Detail, PDF, dan XLSX memakai sumber data anggaran yang sama sehingga angkanya identik.
        </p>
      </div>
    );
  }

  // ------------------------- DAFTAR -------------------------
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => router.push("/keuangan/laporan/anggaran-laba-rugi?baru=1")}
          className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
        >
          <Plus className="h-4 w-4" />
          Buat anggaran
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-sm">Daftar Anggaran</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {budgets === null ? (
            <p className="py-10 text-center text-sm text-slate-400">Memuat daftar anggaran...</p>
          ) : listError ? (
            <p className="py-10 text-center text-sm text-red-600">{listError}</p>
          ) : budgets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                <FileText className="h-6 w-6 text-emerald-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Belum ada anggaran</p>
                <p className="mt-1 text-xs text-slate-500">Buat anggaran laba rugi terlebih dahulu.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Nama Anggaran</TableHead>
                    <TableHead className="text-xs">Periode</TableHead>
                    <TableHead className="text-xs">Terakhir Diubah Oleh</TableHead>
                    <TableHead className="text-right text-xs">Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-xs font-medium text-slate-900">{b.nama}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-600">
                        {labelPeriode(b)} <span className="text-slate-400">· {b.durasi} bulan</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {b.createdBy?.nama ?? "—"}
                        <span className="block text-[11px] text-slate-400">{fmtTgl(b.updatedAt)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          <Button type="button" size="sm" variant="outline" onClick={() => bukaDetail(b.id)} className="cursor-pointer" aria-label={`Buka ${b.nama}`}>
                            <Eye className="h-3.5 w-3.5" />
                            Buka
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/keuangan/laporan/anggaran-laba-rugi?anggaran=${b.id}`)}
                            className="cursor-pointer"
                            aria-label={`Pantau ${b.nama}`}
                          >
                            <MonitorDot className="h-3.5 w-3.5" />
                            Pantau
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => hapus(b.id, b.nama)}
                            className="cursor-pointer text-red-600 hover:text-red-700"
                            aria-label={`Hapus ${b.nama}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GrupRows({ judul, akun, nBulan }: { judul: string; akun: AnggaranDetailSnapshot["revenue"]["akun"]; nBulan: number }) {
  return (
    <Fragment>
      <TableRow className="bg-slate-100/70">
        <TableCell colSpan={nBulan + 2} className="text-xs font-bold uppercase tracking-wide text-slate-700">
          {judul}
        </TableCell>
      </TableRow>
      {akun.map((a) => (
        <TableRow key={a.kode}>
          <TableCell className="pl-6 text-xs text-slate-700">
            <span className="font-mono text-[11px] text-slate-400">{a.kode}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            {a.nama}
          </TableCell>
          {a.bulan.map((v, i) => (
            <TableCell key={i} className="text-right text-xs tabular-nums text-slate-700">
              {v !== 0 ? rp(v) : <span className="text-slate-300">—</span>}
            </TableCell>
          ))}
          <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">{rp(a.total)}</TableCell>
        </TableRow>
      ))}
    </Fragment>
  );
}

function TotalRow({ text, vals, total, grand }: { text: string; vals: number[]; total: number; grand?: boolean }) {
  return (
    <TableRow className={grand ? "bg-emerald-700" : "bg-slate-50/70"}>
      <TableCell className={`text-xs font-semibold ${grand ? "text-white" : "text-slate-900"}`}>{text}</TableCell>
      {vals.map((v, i) => (
        <TableCell key={i} className={`text-right text-xs font-semibold tabular-nums ${grand ? "text-white" : "text-slate-900"}`}>
          {rp(v)}
        </TableCell>
      ))}
      <TableCell className={`text-right text-xs font-semibold tabular-nums ${grand ? "text-white" : "text-slate-900"}`}>
        {rp(total)}
      </TableCell>
    </TableRow>
  );
}
