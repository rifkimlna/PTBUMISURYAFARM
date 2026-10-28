export const dynamic = 'force-dynamic';

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PembelianPerProdukContent } from "@/components/admin/pembelian-per-produk-content";

// Laporan → Pembelian per Produk PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function PembelianPerProdukPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <Link
          href="/keuangan/laporan?tab=pembelian"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Laporan Pembelian
        </Link>
        <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Pembelian per produk</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ringkasan pembelian berdasarkan produk dalam periode tertentu <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <PembelianPerProdukContent />
    </div>
  );
}
