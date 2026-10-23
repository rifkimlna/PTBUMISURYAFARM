import { HutangSupplierContent } from "@/components/admin/hutang-supplier-content";

// Laporan → Hutang Supplier PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function HutangSupplierPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Laporan Hutang Supplier</h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar hutang supplier PT Bumi Surya Farm berdasarkan periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <HutangSupplierContent />
    </div>
  );
}
