import { NeracaContent } from "@/components/admin/neraca-content";

// Laporan → Neraca PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function NeracaPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Laporan Neraca</h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar dokumen Neraca PT Bumi Surya Farm per periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <NeracaContent />
    </div>
  );
}
