"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Sprout } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function PetugasLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/petugas/login";
  const [user, setUser] = useState<{ nama: string; role: string; email: string } | null>(null);

  useEffect(() => {
    if (isLogin) return;
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
      else {
        fetch("/api/auth/me")
          .then((r) => r.json())
          .then((j) => {
            if (j.success) {
              setUser(j.data.user);
              localStorage.setItem("user", JSON.stringify(j.data.user));
              if (j.data.user.role !== "PETUGAS_LAPANGAN" && j.data.user.role !== "ADMIN_PERTANIAN" && j.data.user.role !== "SUPER_ADMIN") {
                router.push("/petugas/login");
              }
            } else router.push("/petugas/login");
          })
          .catch(() => router.push("/petugas/login"));
      }
    } catch {
      router.push("/petugas/login");
    }
  }, [isLogin, router]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/petugas/login");
  };

  if (isLogin) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#FCFCFD] flex flex-col">
      <header className="sticky top-0 z-30 flex h-[56px] items-center justify-between border-b border-slate-100 bg-white/90 backdrop-blur px-4 sm:px-6 gap-2">
        <Link href="/petugas/scan" className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-700 text-white">
            <Sprout className="h-4 w-4" />
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-semibold tracking-tight">PETUGAS LAPANGAN</div>
            <div className="text-[10px] tracking-[0.12em] text-green-700">PT BST</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden sm:block text-right">
              <div className="text-xs font-medium text-slate-900 leading-none">{user.nama}</div>
              <div className="text-[11px] text-slate-500">{user.role}</div>
            </div>
          )}
          <Button variant="ghost" size="icon" className="rounded-full" onClick={logout} title="Keluar">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 max-w-[720px] mx-auto w-full">{children}</main>
      <footer className="border-t border-slate-100 bg-white py-4 text-center text-xs text-slate-400">Petugas Lapangan — Scan QR pohon untuk update</footer>
    </div>
  );
}
