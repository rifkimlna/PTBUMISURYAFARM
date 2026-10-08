import { ProformaInvoiceContent } from "@/components/admin/proforma-invoice-content";

// Laporan → Proforma Invoice List PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function ProformaInvoicePage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <p className="text-xs text-slate-400">Laporan / Penjualan</p>
        <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Proforma Invoice List</h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar faktur proforma PT Bumi Surya Farm berdasarkan periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <ProformaInvoiceContent />
    </div>
  );
}
