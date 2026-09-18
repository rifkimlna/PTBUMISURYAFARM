"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
} from "lucide-react";
import { TransaksiTable } from "@/components/admin/transaksi-table";
import type { TransaksiRow, RingkasanTransaksi } from "@/components/admin/transaksi-table";
import { formatRupiah } from "@/lib/utils";

type PerSumber = {
  KAS: number;
  BANK: number;
  TABUNGAN: number;
  KARTU_KREDIT: number;
};

type Summary = {
  pemasukan: number;
  pengeluaran: number;
  pemasukan30Hari: number;
  pengeluaran30Hari: number;
  pemasukanCount?: number;
  perSumber?: PerSumber;
  saldoKasDanBank?: number;
};

function SummaryCard30({
  label,
  value,
  note,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: number;
  note: string;
  tone?: "neutral" | "positive" | "negative";
  icon?: string;
}) {
  const iconMap: Record<string, React.ElementType> = {
    up: TrendingUp,
    down: TrendingDown,
    wallet: Wallet,
    creditCard: CreditCard,
  };

  const Icon = icon ? (iconMap[icon] || undefined) : undefined;
  const isNeutral = tone === "neutral";

  const cardColors = {
    positive: "border-green-200 bg-green-50",
    negative: "border-red-100 bg-red-50",
    neutral: "border-slate-100 bg-white",
  };

  return (
    <Card
      className={`rounded-2xl border shadow-sm ${cardColors[tone]}`}
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

function AccountCard({
  label,
  saldo,
  keterangan,
  detailHref,
}: {
  label: string;
  saldo: number;
  keterangan: string;
  detailHref: string;
}) {
  return (
    <Card className="border-slate-100 p-6 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M3 4h18"></path>
            <path d="M3 8h18"></path>
            <path d="M3 12h18"></path>
            <path d="M3 16h15"></path>
            <path d="M3 20h12"></path>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium tracking-tight text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">{keterangan}</p>
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
        Rp {formatRupiah(saldo)}
      </p>
      <Link href={detailHref} className={buttonVariants({ variant: "outline", size: "sm" }) + " mt-3 w-full"}>
        Detail
      </Link>
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

  const isFiltered = Boolean(appliedStart || appliedEnd);

  const handleSummaryChange = useCallback((next: RingkasanTransaksi) => {
    setSummary((prev) => ({
      pemasukan: Number(next.pemasukan) || 0,
      pengeluaran: Number(next.pengeluaran) || 0,
      pemasukan30Hari: prev.pemasukan30Hari,
      pengeluaran30Hari: prev.pengeluaran30Hari,
      pemasukanCount: prev.pemasukanCount,
      perSumber: next.perSumber
        ? {
            KAS: next.perSumber.KAS,
            BANK: next.perSumber.BANK,
            TABUNGAN: next.perSumber.TABUNGAN,
            KARTU_KREDIT: prev.perSumber?.KARTU_KREDIT ?? 0,
          }
        : prev.perSumber,
      saldoKasDanBank: next.perSumber ? next.perSumber.KAS + next.perSumber.BANK : prev.saldoKasDanBank,
    }));
  }, []);

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
      {/* 2. CARD RINGKASAN DI BAGIAN ATAS - 4 cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard30
          label="Pemasukan 30 Hari Mendatang"
          value={summary.pemasukan30Hari}
          note={`${summary.pemasukanCount ?? 0} item dalam 30 hari ke depan`}
          tone="positive"
          icon="up"
        />
        <SummaryCard30
          label="Pengeluaran 30 Hari Mendatang"
          value={summary.pengeluaran30Hari}
          note="Total beban"
          tone="negative"
          icon="down"
        />
        <SummaryCard30
          label="Saldo Kas dan Bank"
          value={summary.saldoKasDanBank ?? 0}
          note="Total saldo kas dan bank"
          tone="neutral"
          icon="wallet"
        />
        <SummaryCard30
          label="Saldo Kartu Kredit"
          value={summary.perSumber?.KARTU_KREDIT ?? 0}
          note="Saldo kartu kredit PT BST"
          tone="neutral"
          icon="creditCard"
        />
      </div>

      {/* 3. BAGIAN DAFTAR AKUN */}
      <div className="grid gap-3 md:grid-cols-3">
        <AccountCard
          label="Kas"
          saldo={summary.perSumber?.KAS ?? 0}
          keterangan="Kas · Kode 1101 · Saldo sekarang"
          detailHref="/keuangan/kas/kas"
        />
        <AccountCard
          label="Bank"
          saldo={summary.perSumber?.BANK ?? 0}
          keterangan="Bank · Kode 1103 · Saldo sekarang"
          detailHref="/keuangan/kas/bank"
        />
        <AccountCard
          label="Tabungan"
          saldo={summary.perSumber?.TABUNGAN ?? 0}
          keterangan="Tabungan · Kode 1104 · Saldo sekarang"
          detailHref="/keuangan/kas/tabungan"
        />
      </div>

      <TransaksiTable
        initialData={initialData}
        initialTotal={initialTotal}
        canDelete={canDelete}
        startDate={appliedStart}
        endDate={appliedEnd}
        isFiltered={isFiltered}
        onSummaryChange={handleSummaryChange}
      />
    </div>
  );
}