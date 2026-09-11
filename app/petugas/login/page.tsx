"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sprout } from "lucide-react";
import Link from "next/link";

export default function PetugasLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-6">
      <Card className="w-full max-w-md border-slate-200 shadow-sm mx-auto text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-700 text-white">
            <Sprout className="h-6 w-6" />
          </div>
          <CardTitle className="mt-3">Login Petugas</CardTitle>
          <CardDescription>Login sekarang terpusat di /login — semua role di satu tempat</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">Kamu akan diarahkan ke <span className="font-mono">/login</span> — login dengan <span className="font-medium">petugas@ptbst.id / Lapangan123!</span> otomatis ke <span className="font-mono">/petugas/scan</span></p>
          <Link href="/login">
            <Button className="w-full h-11 bg-green-700 hover:bg-green-800">Ke Halaman Login</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
