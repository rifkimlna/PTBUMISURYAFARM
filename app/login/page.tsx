"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Leaf, LogIn, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
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
      // redirect by role - petugas langsung ke scan lapangan
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
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-[#FCFCFD] px-4 py-6 sm:py-10">
      <Card className="w-full max-w-md border-slate-200 shadow-sm mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-700 text-white">
            <Leaf className="h-5 w-5" />
          </div>
          <CardTitle className="mt-3 text-xl">Login PT Bumi Surya Farm</CardTitle>
          <CardDescription>Semua role di sini — admin & petugas lapangan</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="super@ptbst.id" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin123!" required autoComplete="current-password" className="pr-10" />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {err && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{err}</div>}
            <Button type="submit" disabled={loading} className="w-full bg-green-700 hover:bg-green-800 h-11 cursor-pointer touch-manipulation" style={{ pointerEvents: "auto", touchAction: "manipulation" }}>
              {loading ? "Memproses..." : <><LogIn className="h-4 w-4" /> Login</>}
            </Button>
            <div className="flex justify-between text-xs text-slate-500">
              <Link href="/" className="hover:underline">← Beranda</Link>
              <span>Demo tanpa login juga bisa tambah data</span>
            </div>
            <div className="rounded-lg bg-slate-50 border p-3 text-xs text-slate-600">
              <div className="font-medium">Akun Demo:</div>
              <div>super@ptbst.id — SUPER_ADMIN — Admin123!</div>
              <div>budi@ptbst.id — ADMIN_PERTANIAN — Admin123!</div>
              <div>siti@ptbst.id — ADMIN_KEUANGAN — Admin123!</div>
              <div className="font-medium mt-2 text-green-700">Petugas Lapangan:</div>
              <div>petugas@ptbst.id — PETUGAS_LAPANGAN — Lapangan123!</div>
              <div className="text-[11px] text-slate-500 mt-1">Login di sini semua — petugas otomatis ke /petugas/scan</div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
