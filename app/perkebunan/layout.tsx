"use client";
import { useState, useEffect } from "react";
import { PerkebunanSidebar } from "@/components/admin/sidebar-perkebunan";
import { Menu, Bell, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const ALLOWED = ["SUPER_ADMIN", "ADMIN_PERTANIAN"];

export default function PerkebunanLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const raw = localStorage.getItem("user");
        let role: string | null = null;
        if (raw) {
          const parsed = JSON.parse(raw);
          setUser(parsed);
          role = parsed.role;
        } else {
          const r = await fetch("/api/auth/me");
          const j = await r.json();
          if (j.success) {
            setUser(j.data.user);
            localStorage.setItem("user", JSON.stringify(j.data.user));
            role = j.data.user.role;
          } else {
            router.push("/login");
            return;
          }
        }
        if (role && !ALLOWED.includes(role)) {
          // redirect sesuai role
          if (role === "ADMIN_KEUANGAN") router.push("/keuangan");
          else if (role === "PETUGAS_LAPANGAN") router.push("/petugas/scan");
          else router.push("/login");
          return;
        }
        setChecked(true);
      } catch {
        router.push("/login");
      }
    }
    check();
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

  if (!checked) {
    return <div className="min-h-screen bg-[#FCFCFD] flex items-center justify-center text-sm text-slate-500">Memuat perkebunan...</div>;
  }

  return (
    <div className="min-h-screen bg-[#FCFCFD] overflow-x-hidden">
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[256px] border-r border-slate-100 bg-white lg:block">
        <PerkebunanSidebar />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="fixed left-0 top-0 h-[100dvh] w-[85vw] max-w-[300px] bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <span className="text-sm font-semibold tracking-tight">Menu Perkebunan</span>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <PerkebunanSidebar onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-[256px] min-w-0">
        <header className="sticky top-0 z-20 flex h-[56px] items-center justify-between border-b border-slate-100 bg-white/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="lg:hidden rounded-full shrink-0 cursor-pointer" onClick={() => setOpen(true)} aria-label="Buka menu">
              <Menu className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium tracking-tight text-slate-900 truncate">Perkebunan</div>
            <span className="hidden sm:inline text-xs text-slate-400">/</span>
            <span className="hidden sm:inline text-xs text-slate-500 truncate">pt_bst</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="rounded-full hidden sm:flex">
              <Bell className="h-4 w-4 text-slate-400" />
            </Button>
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right min-w-0">
                  <div className="text-xs font-medium text-slate-900 leading-none truncate max-w-[120px]">{user.nama}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user.role}</div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full cursor-pointer" onClick={logout} title="Logout">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="rounded-full cursor-pointer" onClick={() => router.push("/login")}>Login</Button>
            )}
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1280px] 2xl:max-w-[1440px] 3xl:max-w-[1600px] mx-auto w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
