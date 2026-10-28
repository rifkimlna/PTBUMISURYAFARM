export const dynamic = 'force-dynamic';

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MutasiProdukContent } from "@/components/admin/mutasi-produk-content";

// Laporan → Mutasi Produk PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function MutasiProdukPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <Link
          href="/keuangan/laporan?tab=produk"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Laporan Produk
        </Link>
        <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Mutasi produk</h1>
        <p className="mt-1 text-sm text-slate-400">
          Riwayat mutasi stok per produk (masuk, keluar, dan penyesuaian) sesuai catatan stok
          <span className="whitespace-nowrap"> (dalam satuan)</span>
        </p>
      </div>
      <MutasiProdukContent />
    </div>
  );
}
