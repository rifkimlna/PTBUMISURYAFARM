"use client";

import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar, ArrowLeft, DollarSign, TrendingUp, TrendingDown, Wallet, FileText, Building, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { formatRupiah } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AkunCOA, KelompokCOA } from "@/lib/coa";

type Tipe = "PEMASUKAN" | "PENGELUARAN";

type TransaksiRow = {
  id: string;
  tanggal: string;
  tipe: Tipe;
  kategori: string;
  kodeAkun?: string | null;
  sumberDana?: string | null;
  jumlah: number;
  keterangan: string | null;
  admin: { nama: string };
  buktiCount?: number;
};

type Summary = {
  pemasukan: number;
  pengeluaran: number;
  saldo: number;
};

interface CoaDetailProps {
  akun: AkunCOA;
  initialData: TransaksiRow[];
  initialTotal: number;
  initialSummary: Summary;
}

const KELOMPOK_COLORS: Record<KelompokCOA, string> = {
  Aset: "bg-blue-50 text-blue-700 border-blue-200",
  Kewajiban: "bg-orange-50 text-orange-700 border-orange-200",
  Modal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pendapatan: "bg-green-50 text-green-700 border-green-200",
  Beban: "bg-red-50 text-red-700 border-red-200",
};

const KELOMPOK_ICONS: Record<KelompokCOA, React.ElementType> = {
  Aset: Building,
  Kewajiban: CreditCard,
  Modal: Wallet,
  Pendapatan: DollarSign,
  Beban: TrendingDown,
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function getTipeBadge(tipe: Tipe) {
  return tipe === "PEMASUKAN" ? (
    <Badge variant="success" className="text-[11px]">Masuk</Badge>
  ) : (
    <Badge variant="destructive" className="text-[11px]">Keluar</Badge>
  );
}

function labelSumberDana(key: string | null | undefined): string {
  const map: Record<string, string> = { KAS: "Kas", BANK: "Bank", TABUNGAN: "Tabungan" };
  return map[key || ""] || "—";
}

export function CoaDetail({ akun, initialData, initialTotal, initialSummary }: CoaDetailProps) {
  const [data, setData] = useState<TransaksiRow[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");
  const [filterError, setFilterError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (appliedStart) params.set("startDate", appliedStart);
      if (appliedEnd) params.set("endDate", appliedEnd);

      const res = await fetch(`/api/keuangan/coa/${akun.kode}/transaksi?${params.toString()}`);
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data.data);
        setTotal(result.data.pagination.total);
        setSummary(result.data.summary);
      }
    } catch {
      // keep current data on error
    } finally {
      setLoading(false);
    }
  }, [akun.kode, page, limit, appliedStart, appliedEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applyFilter = () => {
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setFilterError("Tanggal 'Sampai' tidak boleh lebih awal dari tanggal 'Dari'");
      return;
    }
    setFilterError("");
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setPage(1);
  };

  const resetFilter = () => {
    setStartDate("");
    setEndDate("");
    setAppliedStart("");
    setAppliedEnd("");
    setFilterError("");
    setPage(1);
  };

  const isFiltered = Boolean(appliedStart || appliedEnd);

  const Icon = KELOMPOK_ICONS[akun.kelompok];
  const colorClass = KELOMPOK_COLORS[akun.kelompok];

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/keuangan/coa"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Daftar Akun
          </Link>
          <span className="text-slate-300">/</span>
        </div>
      </div>

      {/* Akun Info Card */}
      <Card className="border-slate-100">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", colorClass)}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", colorClass)}>
                    {akun.kelompok}
                  </span>
                  <span className="text-xs text-slate-400">{akun.golongan}</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {akun.kode} - {akun.nama}
                </h1>
                <div className="mt-1.5 flex items-center gap-3 text-sm">
                  <Badge variant={akun.tipe === "PEMASUKAN" ? "success" : akun.tipe === "PENGELUARAN" ? "destructive" : "outline"} className="text-xs">
                    {akun.tipe === "NETRAL" ? "Saldo" : akun.tipe}
                  </Badge>
                </div>
              </div>
            </div>
            <Link
              href="/keuangan/coa"
              className="shrink-0"
            >
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Kembali
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card className="rounded-2xl border border-green-200 bg-green-50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500">
              <TrendingUp className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span>Total Masuk</span>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-green-700">
              Rp {formatRupiah(summary.pemasukan)}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-red-100 bg-red-50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500">
              <TrendingDown className="h-4 w-4 text-red-500" aria-hidden="true" />
              <span>Total Keluar</span>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-red-600">
              Rp {formatRupiah(summary.pengeluaran)}
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "rounded-2xl border shadow-sm",
            summary.saldo >= 0 ? "border-green-200 bg-green-50" : "border-red-100 bg-red-50"
          )}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500">
              <Wallet className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span>Saldo Akun</span>
            </div>
            <div
              className={cn(
                "mt-3 text-2xl sm:text-3xl font-semibold tracking-tight",
                summary.saldo >= 0 ? "text-green-700" : "text-red-600"
              )}
            >
              Rp {formatRupiah(summary.saldo)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Periode */}
      <Card className="border-slate-100">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-600">Dari Tanggal</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-auto min-w-[160px]"
                />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-600">Sampai Tanggal</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 w-auto min-w-[160px]"
                />
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <Button size="sm" onClick={applyFilter} disabled={loading}>
                  <Calendar className="h-3.5 w-3.5" /> Terapkan
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetFilter}
                  disabled={!isFiltered && !startDate && !endDate && loading}
                >
                  Reset
                </Button>
              </div>
            </div>
            {filterError && <p className="text-sm text-red-600">{filterError}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Transaksi Table */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm">Transaksi Akun</CardTitle>
            <p className="mt-1 text-xs text-slate-500">{total} entri</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Tanggal</TableHead>
                  <TableHead className="w-[90px]">Tipe</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="w-[140px]" style={{ textAlign: "right" }}>Jumlah</TableHead>
                  <TableHead className="w-[100px]">Sumber Dana</TableHead>
                  <TableHead className="w-[120px]">Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                      {isFiltered
                        ? "Tidak ada transaksi pada periode ini"
                        : `Belum ada transaksi untuk akun ${akun.kode}`}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs text-slate-500">{formatDate(row.tanggal)}</TableCell>
                      <TableCell>{getTipeBadge(row.tipe)}</TableCell>
                      <TableCell className="text-sm text-slate-700">{row.kodeAkun ? `${row.kodeAkun} - ` : ""}{row.kategori}</TableCell>
                      <TableCell
                        className={cn(
                          "text-sm font-medium tracking-tight text-right",
                          row.tipe === "PEMASUKAN" ? "text-green-700" : "text-red-600"
                        )}
                      >
                        {row.tipe === "PEMASUKAN" ? "+" : "-"} Rp {formatRupiah(row.jumlah)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{labelSumberDana(row.sumberDana)}</TableCell>
                      <TableCell className="text-xs text-slate-500">{row.admin.nama}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {loading && (
            <div className="flex h-12 items-center justify-center text-sm text-slate-400">
              Memuat...
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-xs text-slate-400">
              Halaman {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}