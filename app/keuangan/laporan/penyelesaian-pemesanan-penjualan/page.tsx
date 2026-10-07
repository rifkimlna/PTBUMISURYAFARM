import { PenyelesaianPemesananContent } from "@/components/admin/penyelesaian-pemesanan-content";

// Laporan → Penyelesaian Pemesanan Penjualan PT Bumi Surya Farm (data aktual database, tanpa dummy).
export default function PenyelesaianPemesananPage() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Penyelesaian Pemesanan Penjualan</h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar penyelesaian pesanan penjualan PT Bumi Surya Farm per periode <span className="whitespace-nowrap">(dalam IDR)</span>
        </p>
      </div>
      <PenyelesaianPemesananContent />
    </div>
  );
}
