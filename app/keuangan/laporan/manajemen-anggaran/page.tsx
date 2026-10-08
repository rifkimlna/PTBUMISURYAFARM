import { ManajemenAnggaranContent } from "@/components/admin/manajemen-anggaran-content";

// Manajemen Anggaran PT Bumi Surya Farm — daftar anggaran tersimpan,
// detail per anggaran (data asli), dan export PDF/XLSX.
export default function ManajemenAnggaranPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Manajemen Anggaran</h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelola anggaran laba rugi PT Bumi Surya Farm <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <ManajemenAnggaranContent />
    </div>
  );
}
