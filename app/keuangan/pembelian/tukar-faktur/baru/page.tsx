import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TukarFakturBeliForm } from "@/components/admin/pembelian-forms";

export default function TukarFakturBaruPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/keuangan/pembelian?tab=tukar-faktur"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali ke Pembelian
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Tukar Faktur Pembelian</h1>
        <p className="mt-1 text-sm text-slate-400">
          Berdasarkan faktur pembelian yang sudah ada dan belum lunas. Tidak membuat utang atau Kas & Bank baru.
        </p>
      </div>
      <TukarFakturBeliForm />
    </div>
  );
}
