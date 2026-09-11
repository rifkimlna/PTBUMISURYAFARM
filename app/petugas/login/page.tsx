"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sprout, LogIn, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function PetugasLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Login gagal");
      const { token, user } = j.data;
      if (token) localStorage.setItem("token", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));
      // Role based redirect - petugas langsung ke scan
      if (user.role === "PETUGAS_LAPANGAN") router.push("/petugas/scan");
      else if (user.role === "ADMIN_PERTANIAN") router.push("/admin/pertanian");
      else if (user.role === "ADMIN_KEUANGAN") router.push("/admin/keuangan");
      else router.push("/admin");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-6">
      <Card className="w-full max-w-md border-slate-200 shadow-sm mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-700 text-white">
            <Sprout className="h-6 w-6" />
          </div>
          <CardTitle className="mt-3 text-xl">Login Petugas Lapangan</CardTitle>
          <CardDescription>Masuk untuk scan QR & update tiap pohon — data global, admin ikut terupdate</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Petugas</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="petugas@ptbst.id" required autoComplete="email" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Lapangan123!" required autoComplete="current-password" className="pr-10 h-11" />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {err && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{err}</div>}
            <Button type="submit" disabled={loading} className="w-full bg-green-700 hover:bg-green-800 h-11 text-sm font-medium pointer-events-auto cursor-pointer">
              {loading ? "Memproses..." : <><LogIn className="h-4 w-4" /> Masuk sebagai Petugas</>}
            </Button>
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800">
              <div className="font-medium">Akun Demo Petugas:</div>
              <div>petugas@ptbst.id — PETUGAS_LAPANGAN</div>
              <div>Password: <span className="font-mono font-medium">Lapangan123!</span></div>
              <div className="mt-1 text-[11px]">Admin tetap via <Link href="/login" className="underline">/login</Link> (Admin123!)</div>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <Link href="/" className="hover:underline">← Beranda</Link>
              <Link href="/login" className="hover:underline">Login Admin →</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
