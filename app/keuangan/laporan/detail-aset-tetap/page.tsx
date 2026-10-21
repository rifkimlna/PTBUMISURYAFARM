import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DetailAsetTetapContent } from "@/components/admin/detail-aset-tetap-content";

// Laporan -> Detail Aset Tetap PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function DetailAsetTetapPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <Link
          href="/keuangan/laporan?tab=aset"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Laporan Aset
        </Link>
        <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
          Detail aset tetap
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Riwayat transaksi per aset tetap: akuisisi, penyusutan (informatif), dan pelepasan
          <span className="whitespace-nowrap"> (dalam IDR)</span>
        </p>
      </div>
      <DetailAsetTetapContent />
    </div>
  );
}
