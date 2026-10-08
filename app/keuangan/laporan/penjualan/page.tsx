import { DaftarPenjualanContent } from "@/components/admin/daftar-penjualan-content";

// Laporan → Daftar Penjualan PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function DaftarPenjualanPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Daftar Penjualan</h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar transaksi penjualan PT Bumi Surya Farm per periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <DaftarPenjualanContent />
    </div>
  );
}
