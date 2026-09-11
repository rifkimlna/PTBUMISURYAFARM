"use client";
import { useState, useEffect } from "react";
import { Menu, Shield, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminHubLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUser(parsed);
        if (parsed.role !== "SUPER_ADMIN") {
          // redirect non-super ke modulnya
          if (parsed.role === "ADMIN_PERTANIAN") router.push("/perkebunan");
          else if (parsed.role === "ADMIN_KEUANGAN") router.push("/keuangan");
          else if (parsed.role === "PETUGAS_LAPANGAN") router.push("/petugas/scan");
        }
      } else {
        fetch("/api/auth/me")
          .then((r) => r.json())
          .then((j) => {
            if (j.success) {
              setUser(j.data.user);
              localStorage.setItem("user", JSON.stringify(j.data.user));
              const role = j.data.user.role;
              if (role !== "SUPER_ADMIN") {
                if (role === "ADMIN_PERTANIAN") router.push("/perkebunan");
                else if (role === "ADMIN_KEUANGAN") router.push("/keuangan");
                else if (role === "PETUGAS_LAPANGAN") router.push("/petugas/scan");
              }
            } else router.push("/login");
          })
          .catch(() => router.push("/login"));
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const logout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#FCFCFD]">
      <header className="sticky top-0 z-30 flex h-[56px] items-center justify-between border-b border-slate-100 bg-white/90 backdrop-blur-md px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden rounded-full" onClick={() => setOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white">
            <Shield className="h-3.5 w-3.5" />
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-semibold tracking-tight">SUPER ADMIN HUB</div>
            <div className="text-[10px] tracking-widest text-slate-500">PT BUMI SURYA FARM</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-medium leading-none">{user.nama}</div>
                <div className="text-[11px] text-slate-500">{user.role}</div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed left-0 top-0 h-[100dvh] w-[85vw] max-w-[300px] bg-white p-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <nav className="space-y-2">
              <Link href="/perkebunan" onClick={() => setOpen(false)} className="block rounded-full px-3 py-2 text-sm hover:bg-slate-50">Perkebunan</Link>
              <Link href="/keuangan" onClick={() => setOpen(false)} className="block rounded-full px-3 py-2 text-sm hover:bg-slate-50">Keuangan</Link>
              <Link href="/petugas/scan" onClick={() => setOpen(false)} className="block rounded-full px-3 py-2 text-sm hover:bg-slate-50">Petugas</Link>
              <Link href="/" onClick={() => setOpen(false)} className="block rounded-full px-3 py-2 text-sm hover:bg-slate-50">Publik</Link>
            </nav>
          </div>
        </div>
      )}

      <nav className="hidden lg:flex items-center gap-2 border-b border-slate-100 bg-white px-8 py-2">
        <Link href="/perkebunan" className="rounded-full px-3 py-1.5 text-xs font-medium hover:bg-slate-50">Perkebunan</Link>
        <Link href="/keuangan" className="rounded-full px-3 py-1.5 text-xs font-medium hover:bg-slate-50">Keuangan</Link>
        <Link href="/petugas/scan" className="rounded-full px-3 py-1.5 text-xs font-medium hover:bg-slate-50">Petugas</Link>
        <Link href="/" className="rounded-full px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">Publik</Link>
      </nav>

      <main className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1280px] mx-auto w-full">{children}</main>
    </div>
  );
}
