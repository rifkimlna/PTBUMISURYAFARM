import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { KirimForm } from "@/components/admin/kas-money-forms";

export default function KirimUangPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/keuangan/kas"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Kas & Bank
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Kirim Uang</h1>
        <p className="mt-1 text-sm text-slate-400">
          Catat pengeluaran dari Kas, Bank, dan Tabungan PT Bumi Surya Farm
        </p>
      </div>
      <KirimForm />
    </div>
  );
}
