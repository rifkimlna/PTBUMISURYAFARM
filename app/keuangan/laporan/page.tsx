import { LaporanContent } from "@/components/admin/laporan-content";

// Halaman Laporan PT BST — UI SAJA (tahap awal).
// Tanpa halaman detail, API, maupun database laporan.
const TAB_VALID = [
  "sekilas-bisnis",
  "penjualan",
  "pembelian",
  "produk",
  "aset",
  "produksi",
];

export default async function LaporanPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const initialTab = TAB_VALID.includes(params.tab ?? "") ? params.tab : "sekilas-bisnis";
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">Laporan</h1>
        <p className="mt-1 text-sm text-slate-400">Pilih jenis laporan keuangan dan operasional PT Bumi Surya Farm.</p>
      </div>
      <LaporanContent initialTab={initialTab} />
    </div>
  );
}
