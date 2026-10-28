export const dynamic = 'force-dynamic';

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PenjualanPerProdukContent } from "@/components/admin/penjualan-per-produk-content";

// Laporan → Penjualan per Produk PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function PenjualanPerProdukPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <Link
          href="/keuangan/laporan?tab=penjualan"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Laporan Penjualan
        </Link>
        <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Penjualan per produk</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ringkasan penjualan berdasarkan produk dalam periode tertentu <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <PenjualanPerProdukContent />
    </div>
  );
}
