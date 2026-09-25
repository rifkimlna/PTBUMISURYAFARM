import { LaporanContent } from "@/components/admin/laporan-content";

// Halaman Laporan PT BST — UI SAJA (tahap awal).
// Tanpa halaman detail, API, maupun database laporan.
export default function LaporanPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Laporan</h1>
        <p className="mt-1 text-sm text-slate-400">Pilih jenis laporan keuangan dan operasional PT Bumi Surya Farm.</p>
      </div>
      <LaporanContent />
    </div>
  );
}
