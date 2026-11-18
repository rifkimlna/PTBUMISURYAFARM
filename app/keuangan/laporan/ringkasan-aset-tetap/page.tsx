export const dynamic = 'force-dynamic';

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RingkasanAsetContent } from "@/components/admin/ringkasan-aset-content";

// Laporan -> Ringkasan Aset Tetap PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function RingkasanAsetTetapPage() {
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
          Ringkasan aset tetap
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Biaya perolehan, akumulasi penyusutan, dan nilai buku aset aktif pada tanggal akhir periode
          <span className="whitespace-nowrap"> (dalam IDR)</span>
        </p>
      </div>
      <RingkasanAsetContent />
    </div>
  );
}
