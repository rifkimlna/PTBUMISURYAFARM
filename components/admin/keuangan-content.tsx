"use client";

import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarRange, RotateCcw, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { TransaksiTable } from "@/components/admin/transaksi-table";
import type { TransaksiRow } from "@/components/admin/transaksi-table";
import { ArusKasChart } from "@/components/admin/arus-kas-chart";
import { labelSumberDana, SUMBER_DANA_KEYS } from "@/lib/coa";
import { formatRupiah } from "@/lib/utils";

type PerSumber = { KAS: number; BANK: number; TABUNGAN: number };

type Summary = {
  pemasukan: number;
  pengeluaran: number;
  saldo: number;
  pemasukanCount?: number;
  perSumber?: PerSumber;
};

type SummaryCardTone = "neutral" | "positive" | "negative";
type SummaryCardIcon = "up" | "down" | "wallet";

const summaryIcons = {
  up: TrendingUp,
  down: TrendingDown,
  wallet: Wallet,
} as const;

function SummaryCard({
  label,
  value,
  note,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: number;
  note: string;
  tone?: SummaryCardTone;
  icon?: SummaryCardIcon;
}) {
  const Icon = icon ? summaryIcons[icon] : undefined;
  const isNeutral = tone === "neutral";

  return (
    <Card
      className={`rounded-2xl border ${isNeutral ? "border-slate-100" : "border-green-200"} ${
        isNeutral ? "bg-white" : "bg-green-50/50"
      } shadow-[0_1px_3px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.04)]`}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500">
          {Icon && (
            <Icon
              aria-hidden="true"
              className={`h-4 w-4 ${isNeutral ? "text-slate-400" : tone === "negative" ? "text-red-500" : "text-green-600"}`}
            />
          )}
          <span>{label}</span>
        </div>
        <div
          className={`mt-3 text-2xl sm:text-3xl font-semibold tracking-tight ${
            tone === "positive" ? "text-green-700" : tone === "negative" ? "text-red-600" : "text-slate-900"
          }`}
        >
          Rp {formatRupiah(value)}
        </div>
        <div className="mt-1.5 text-xs text-slate-400">{note}</div>
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
    setSummary((prev) => ({
      pemasukan: Number(next.pemasukan) || 0,
      pengeluaran: Number(next.pengeluaran) || 0,
      saldo: Number(next.saldo) || 0,
      pemasukanCount: next.pemasukanCount ?? prev.pemasukanCount,
      perSumber: next.perSumber ?? prev.perSumber,
    }));
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
        <SummaryCard
          label="Pemasukan"
          value={summary.pemasukan}
          note={`${summary.pemasukanCount ?? 0} transaksi tercatat`}
          tone="positive"
          icon="up"
        />
        <SummaryCard
          label="Pengeluaran"
          value={summary.pengeluaran}
          note="Total beban"
          tone="negative"
          icon="down"
        />
        <SummaryCard
          label="Saldo"
          value={summary.saldo}
          note={summary.saldo >= 0 ? "Surplus" : "Defisit"}
          tone={summary.saldo >= 0 ? "positive" : "negative"}
          icon="wallet"
        />
      </div>

      {/* Posisi dana per sumber — ikut filter tanggal */}
      <Card className="border-slate-100">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500">
              <Wallet className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span>Posisi Dana</span>
            </div>
            <span className="text-xs text-slate-400">{periodeNote}</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SUMBER_DANA_KEYS.map((sumber) => {
              const nilai = summary.perSumber?.[sumber] ?? 0;
              return (
                <div
                  key={sumber}
                  className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5"
                >
                  <span className="text-xs text-slate-500">{labelSumberDana(sumber)}</span>
                  <span
                    className={`text-sm font-semibold tracking-tight ${nilai < 0 ? "text-red-600" : "text-slate-900"}`}
                    title={nilai < 0 ? "Saldo negatif — cek mutasi sumber dana" : undefined}
                  >
                    Rp {formatRupiah(nilai)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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