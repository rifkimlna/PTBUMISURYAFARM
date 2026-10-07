import { PiutangPelangganContent } from "@/components/admin/piutang-pelanggan-content";

// Laporan → Piutang Pelanggan PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function PiutangPelangganPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Laporan Piutang Pelanggan</h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar piutang pelanggan PT Bumi Surya Farm berdasarkan periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <PiutangPelangganContent />
    </div>
  );
}
