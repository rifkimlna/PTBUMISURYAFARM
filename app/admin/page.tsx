import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trees, Wallet, Shield, ArrowRight } from "lucide-react";

export default function AdminIndex() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2"><Shield className="h-5 w-5" /> Super Admin Hub</h1>
        <p className="text-sm text-slate-500">Akses penuh — pilih modul. ADMIN_PERTANIAN → /perkebunan, ADMIN_KEUANGAN → /keuangan.</p>
      </div>
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trees className="h-5 w-5 text-green-800" /> Perkebunan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Dashboard pertanian, data pohon, QR, riwayat & panen. Lokasi baru: /perkebunan</p>
            <Link href="/perkebunan" className="block">
              <Button className="bg-green-700 hover:bg-green-800 w-full sm:w-auto cursor-pointer">
                Buka Perkebunan <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-slate-400">Lama /admin/pertanian tetap redirect ke /perkebunan</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-700" /> Keuangan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Kas, karyawan, aset & persediaan. Lokasi baru: /keuangan</p>
            <Link href="/keuangan" className="block">
              <Button className="bg-emerald-700 hover:bg-emerald-800 w-full sm:w-auto cursor-pointer">
                Buka Keuangan <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link href="/keuangan/kas" className="text-emerald-700 hover:underline">Kas →</Link>
              <Link href="/keuangan/karyawan" className="text-emerald-700 hover:underline">Karyawan →</Link>
              <Link href="/keuangan/aset" className="text-emerald-700 hover:underline">Aset →</Link>
              <Link href="/keuangan/persediaan" className="text-emerald-700 hover:underline">Persediaan →</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
