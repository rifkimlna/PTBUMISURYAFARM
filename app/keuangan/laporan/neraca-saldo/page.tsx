import { NeracaSaldoContent } from "@/components/admin/neraca-saldo-content";

// Laporan → Neraca Saldo / Trial Balance PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function NeracaSaldoPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Laporan Neraca Saldo</h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar saldo debit dan kredit setiap akun PT Bumi Surya Farm per periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <NeracaSaldoContent />
    </div>
  );
}
