"use client";
import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Menu, Bell, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [user, setUser] = useState<{ nama: string; role: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
      else fetch("/api/auth/me").then((r) => r.json()).then((j) => { if (j.success) { setUser(j.data.user); localStorage.setItem("user", JSON.stringify(j.data.user)); } }).catch(() => {});
    } catch {}
  }, []);
  // Lock body when drawer open (mobile & tablet)
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
    <div className="min-h-screen bg-[#FCFCFD] overflow-x-hidden">
      {/* Desktop sidebar - hidden until lg to support tablet drawer */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[256px] border-r border-slate-100 bg-white lg:block">
        <AdminSidebar />
      </aside>

      {/* Mobile/Tablet drawer - from md to lg it is drawer, fixes iPad layout broken */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="fixed left-0 top-0 h-[100dvh] w-[85vw] max-w-[300px] bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <span className="text-sm font-semibold tracking-tight">Menu</span>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <AdminSidebar onNavigate={() => setOpen(false)} />
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
            <div className="text-sm font-medium tracking-tight text-slate-900 truncate">Admin</div>
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
        {/* Fluid main - scales from HP to ultra-wide monitor */}
        <main className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1280px] 2xl:max-w-[1440px] 3xl:max-w-[1600px] mx-auto w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
