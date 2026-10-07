import { PerubahanModalContent } from "@/components/admin/perubahan-modal-content";

// Laporan → Perubahan Modal PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function PerubahanModalPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Laporan Perubahan Modal</h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar dokumen Perubahan Modal PT Bumi Surya Farm per periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <PerubahanModalContent />
    </div>
  );
}
