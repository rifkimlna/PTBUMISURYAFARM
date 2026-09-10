"use client";
import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Menu, Bell, LogOut } from "lucide-react";
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
  const logout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };
  return (
    <div className="min-h-screen bg-[#FCFCFD]">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[256px] border-r border-slate-100 bg-white md:block">
        <AdminSidebar />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="fixed left-0 top-0 h-screen w-64 bg-white shadow-xl">
            <AdminSidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="md:pl-[256px]">
        <header className="sticky top-0 z-20 flex h-[56px] items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md px-4 md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden rounded-full" onClick={() => setOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium tracking-tight text-slate-900">Admin</div>
            <span className="hidden text-xs text-slate-400 md:inline">/</span>
            <span className="hidden text-xs text-slate-500 md:inline">pt_bst</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Bell className="h-4 w-4 text-slate-400" />
            </Button>
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-medium text-slate-900 leading-none">{user.nama}</div>
                  <div className="text-[11px] text-slate-500">{user.role}</div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={logout} title="Logout">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push("/login")}>Login</Button>
            )}
          </div>
        </header>
        <main className="p-6 md:p-8 lg:p-10 max-w-[1200px]">{children}</main>
      </div>
    </div>
  );
}
