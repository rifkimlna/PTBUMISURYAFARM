import { PenjualanPerProdukContent } from "@/components/admin/penjualan-per-produk-content";

// Laporan → Penjualan per Produk PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function PenjualanPerProdukPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Penjualan per produk</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ringkasan penjualan berdasarkan produk dalam periode tertentu <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <PenjualanPerProdukContent />
    </div>
  );
}
