import { JurnalContent } from "@/components/admin/jurnal-content";

// Laporan → Jurnal PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function JurnalPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Laporan Jurnal</h1>
        <p className="mt-1 text-sm text-slate-400">
          Seluruh jurnal transaksi PT Bumi Surya Farm secara kronologis <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <JurnalContent />
    </div>
  );
}
