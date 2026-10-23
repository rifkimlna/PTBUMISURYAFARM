import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PengirimanPenjualanContent } from "@/components/admin/pengiriman-penjualan-content";

// Laporan → Pengiriman Penjualan PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function PengirimanPenjualanPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <Link
          href="/keuangan/laporan?tab=penjualan"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Laporan Penjualan
        </Link>
        <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Pengiriman Penjualan</h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar pengiriman penjualan PT Bumi Surya Farm per periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <PengirimanPenjualanContent />
    </div>
  );
}
