import { UsiaPiutangContent } from "@/components/admin/usia-piutang-content";

// Laporan → Usia Piutang PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function UsiaPiutangPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Piutang</h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar umur piutang pelanggan berdasarkan periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <UsiaPiutangContent />
    </div>
  );
}
