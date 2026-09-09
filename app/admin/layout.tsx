"use client";
import { useState } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Menu, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
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
            <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs">A</div>
          </div>
        </header>
        <main className="p-6 md:p-8 lg:p-10 max-w-[1200px]">{children}</main>
      </div>
    </div>
  );
}
