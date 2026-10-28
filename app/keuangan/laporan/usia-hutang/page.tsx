export const dynamic = 'force-dynamic';

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { UsiaHutangContent } from "@/components/admin/usia-hutang-content";

// Laporan → Usia Hutang Pembelian PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function UsiaHutangPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <Link
          href="/keuangan/laporan?tab=pembelian"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Laporan Pembelian
        </Link>
        <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
          Usia Hutang Pembelian
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Pengelompokan hutang pembelian berdasarkan umur jatuh tempo <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <UsiaHutangContent />
    </div>
  );
}
