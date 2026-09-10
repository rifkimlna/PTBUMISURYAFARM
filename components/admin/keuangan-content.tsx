"use client";

import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarRange, RotateCcw } from "lucide-react";
import { TransaksiTable } from "@/components/admin/transaksi-table";
import type { TransaksiRow } from "@/components/admin/transaksi-table";
import { ArusKasChart } from "@/components/admin/arus-kas-chart";
import { formatRupiah } from "@/lib/utils";

type Summary = { pemasukan: number; pengeluaran: number; saldo: number };

function SummaryCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone?: string;
}) {
  return (
    <Card className="border-slate-100">
      <CardContent className="p-5">
        <div className="text-xs tracking-wide text-slate-400">{label}</div>
        <div className={`mt-2 text-2xl font-semibold tracking-tight ${tone || "text-slate-900"}`}>
          Rp {formatRupiah(value)}
        </div>
        <div className="mt-1 text-xs text-slate-400">{note}</div>
      </CardContent>
    </Card>
  );
}

export function KeuanganContent({
  initialData,
  initialTotal,
  canDelete,
  initialSummary,
}: {
  initialData: TransaksiRow[];
  initialTotal: number;
  canDelete: boolean;
  initialSummary: Summary;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");
  const [filterError, setFilterError] = useState("");
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [refreshKey, setRefreshKey] = useState(0);

  const isFiltered = Boolean(appliedStart || appliedEnd);

  const handleSummaryChange = useCallback((next: Summary) => {
    setSummary({
      pemasukan: Number(next.pemasukan) || 0,
      pengeluaran: Number(next.pengeluaran) || 0,
      saldo: Number(next.saldo) || 0,
    });
  }, []);

  const handleDataChange = useCallback(() => setRefreshKey((key) => key + 1), []);

  const applyFilter = () => {
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setFilterError("Tanggal 'Sampai' tidak boleh lebih awal dari tanggal 'Dari'");
      return;
    }
    setFilterError("");
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  };

  const resetFilter = () => {
    setStartDate("");
    setEndDate("");
    setAppliedStart("");
    setAppliedEnd("");
    setFilterError("");
  };

  const periodeNote = isFiltered
    ? `Periode: ${appliedStart || "Awal"} — ${appliedEnd || "Sekarang"}`
    : "Semua transaksi";

  return (
    <div className="space-y-6">
      <Card className="border-slate-100">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-600">Dari Tanggal</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-9 w-auto min-w-[160px]"
                />
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-600">Sampai Tanggal</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-9 w-auto min-w-[160px]"
                />
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <Button size="sm" onClick={applyFilter}>
                  <CalendarRange className="h-3.5 w-3.5" /> Terapkan
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetFilter}
                  disabled={!isFiltered && !startDate && !endDate}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
              </div>
            </div>
            <span className="text-xs text-slate-400">{periodeNote}</span>
          </div>
          {filterError && <p className="mt-3 text-sm text-red-600">{filterError}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Pemasukan" value={summary.pemasukan} note="PEMASUKAN" />
        <SummaryCard label="Pengeluaran" value={summary.pengeluaran} note="PENGELUARAN" tone="text-slate-500" />
        <SummaryCard
          label="Saldo"
          value={summary.saldo}
          note="Pemasukan − Pengeluaran"
          tone={summary.saldo < 0 ? "text-red-500" : "text-slate-900"}
        />
      </div>

      <ArusKasChart refreshKey={refreshKey} />

      <TransaksiTable
        initialData={initialData}
        initialTotal={initialTotal}
        canDelete={canDelete}
        startDate={appliedStart}
        endDate={appliedEnd}
        isFiltered={isFiltered}
        onSummaryChange={handleSummaryChange}
        onDataChange={handleDataChange}
      />
    </div>
  );
}