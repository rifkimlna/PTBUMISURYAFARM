import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trees, Wallet, ArrowRight } from "lucide-react";

export default function AdminIndex() {
  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Selamat Datang, Admin</h1>
        <p className="text-sm text-slate-500">Pilih modul sesuai role Anda.</p>
      </div>
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trees className="h-5 w-5 text-green-800" /> Manajemen Pertanian
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Kelola data pohon, cetak QR, dan log riwayat kesehatan lapangan.</p>
            <Link href="/admin/pertanian" className="block">
              <Button className="bg-green-700 hover:bg-green-800 w-full sm:w-auto cursor-pointer">
                Buka Pertanian <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-800" /> Keuangan & HR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Kas, data karyawan, gaji bulanan, dan inventaris aset.</p>
            <Link href="/admin/keuangan" className="block">
              <Button variant="outline" className="border-green-600 text-green-800 w-full sm:w-auto cursor-pointer">
                Buka Keuangan <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
