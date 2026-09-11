"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Trees, QrCode, ClipboardList, ScanLine, LogOut, Leaf } from "lucide-react";

const perkebunanMenu = [
  { label: "Dashboard", href: "/perkebunan", icon: LayoutDashboard },
  { label: "Data Pohon", href: "/perkebunan/pohon", icon: Trees },
  { label: "Cetak QR", href: "/perkebunan/qr", icon: QrCode },
  { label: "Log Riwayat", href: "/perkebunan/riwayat", icon: ClipboardList },
  { label: "Scan Koreksi", href: "/perkebunan/scan", icon: ScanLine },
];

function NavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-full px-3.5 py-2.5 text-[13px] font-medium transition-colors cursor-pointer touch-manipulation",
        active ? "bg-[#f0fdf4] text-green-800 ring-1 ring-green-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-green-800" : "text-slate-400")} />
      {label}
    </Link>
  );
}

export function PerkebunanSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-[64px] items-center gap-3 px-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-700 text-white">
          <Leaf className="h-3.5 w-3.5" />
        </div>
        <div className="leading-none">
          <div className="text-[13px] font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</div>
          <div className="text-[10px] tracking-widest text-green-700">PERKEBUNAN</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-6 space-y-7">
        <div>
          <div className="px-3 pb-3 text-[10px] font-medium tracking-[0.14em] text-slate-400">PERKEBUNAN</div>
          <div className="space-y-1">
            {perkebunanMenu.map((m) => (
              <div key={m.href} onClick={onNavigate}>
                <NavItem {...m} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-1">
        <Link href="/admin" className="flex items-center gap-2 rounded-full px-3 py-2 text-xs text-slate-400 hover:text-slate-900 hover:bg-slate-50">
          <LogOut className="h-3.5 w-3.5" /> Hub Admin
        </Link>
        <Link href="/" className="flex items-center gap-2 rounded-full px-3 py-2 text-xs text-slate-400 hover:text-slate-900 hover:bg-slate-50">
          <LogOut className="h-3.5 w-3.5" /> Ke Publik
        </Link>
      </div>
    </div>
  );
}
