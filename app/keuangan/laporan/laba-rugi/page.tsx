import { LabaRugiContent } from "@/components/admin/laba-rugi-content";

// Laporan → Laba Rugi PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function LabaRugiPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Laporan Laba Rugi</h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar dokumen Laba Rugi PT Bumi Surya Farm per periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <LabaRugiContent />
    </div>
  );
}
