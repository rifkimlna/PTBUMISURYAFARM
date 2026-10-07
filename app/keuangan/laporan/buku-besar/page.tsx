import { BukuBesarContent } from "@/components/admin/buku-besar-content";

// Laporan → Buku Besar PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function BukuBesarPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Laporan Buku Besar</h1>
        <p className="mt-1 text-sm text-slate-400">
          Rincian mutasi setiap akun PT Bumi Surya Farm per periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <BukuBesarContent />
    </div>
  );
}
