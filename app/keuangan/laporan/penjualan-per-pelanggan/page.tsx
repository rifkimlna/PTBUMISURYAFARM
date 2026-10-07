import { JualPerPelangganContent } from "@/components/admin/jual-per-pelanggan-content";

// Laporan → Penjualan per Pelanggan PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function JualPerPelangganPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Penjualan per pelanggan</h1>
        <p className="mt-1 text-sm text-slate-400">
          Penjualan berdasarkan pelanggan dalam periode tertentu <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <JualPerPelangganContent />
    </div>
  );
}
