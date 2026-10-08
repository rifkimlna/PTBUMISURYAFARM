import { AnggaranLabaRugiContent } from "@/components/admin/anggaran-laba-rugi-content";

// Anggaran Laba Rugi PT Bumi Surya Farm — pantau realisasi anggaran vs aktual
// per periode (dalam IDR). Penyusunan anggaran maksimal 6 bulan per dokumen.
export default function AnggaranLabaRugiPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Anggaran Laba Rugi</h1>
        <p className="mt-1 text-sm text-slate-400">
          Pantau anggaran vs realisasi aktual per periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <AnggaranLabaRugiContent />
    </div>
  );
}
