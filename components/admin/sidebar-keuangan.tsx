"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Wallet, Package, Boxes, LogOut, Leaf, BookOpen, Settings, Receipt, FileText, ShoppingBag, Banknote, Contact } from "lucide-react";

const keuanganMenu = [
  { label: "Dashboard", href: "/keuangan", icon: LayoutDashboard },
  { label: "Kas & Bank", href: "/keuangan/kas", icon: Wallet },
  { label: "Penjualan", href: "/keuangan/penjualan", icon: Receipt },
  { label: "Pembelian", href: "/keuangan/pembelian", icon: ShoppingBag },
  { label: "Biaya", href: "/keuangan/biaya", icon: Banknote },
  { label: "Laporan", href: "/keuangan/laporan", icon: FileText },
];

const masterDataMenu = [
  { label: "Kontak", href: "/keuangan/kontak", icon: Contact },
  { label: "Produk", href: "/keuangan/produk", icon: Boxes },
  { label: "Aset", href: "/keuangan/aset", icon: Package },
];

const pengaturanMenu = [
  { label: "Daftar Akun", href: "/keuangan/coa", icon: BookOpen },
];

function NavItem({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const pathname = usePathname();
  const isRoot = href === "/keuangan";
  const active = isRoot ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-full px-3.5 py-2.5 text-[13px] font-medium transition-colors cursor-pointer touch-manipulation",
        active ? "bg-green-700 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-white" : "text-slate-400")} />
      {label}
    </Link>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <div className="px-3 pb-3 text-[10px] font-medium tracking-[0.14em] text-slate-400">{title}</div>;
}

export function KeuanganSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-[64px] items-center gap-3 px-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-white">
          <Leaf className="h-3.5 w-3.5" />
        </div>
        <div className="leading-none">
          <div className="text-[13px] font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</div>
          <div className="text-[10px] tracking-widest text-emerald-700">KEUANGAN</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-6 space-y-7">
        <div>
          <SectionTitle title="KEUANGAN" />
          <div className="space-y-1">
            {keuanganMenu.map((m) => (
              <div key={m.href} onClick={onNavigate}>
                <NavItem {...m} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle title="DATA MASTER" />
          <div className="space-y-1">
            {masterDataMenu.map((m) => (
              <div key={m.href} onClick={onNavigate}>
                <NavItem {...m} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle title="PENGATURAN" />
          <div className="space-y-1">
            {pengaturanMenu.map((m) => (
              <div key={m.href} onClick={onNavigate}>
                <NavItem {...m} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-1">
        <Link href="/admin" className="flex items-center gap-2 rounded-full px-3 py-2 text-xs text-slate-400 hover:text-slate-900 hover:bg-slate-50">
          <Settings className="h-3.5 w-3.5" /> Hub Admin
        </Link>
        <Link href="/" className="flex items-center gap-2 rounded-full px-3 py-2 text-xs text-slate-400 hover:text-slate-900 hover:bg-slate-50">
          <LogOut className="h-3.5 w-3.5" /> Ke Publik
        </Link>
      </div>
    </div>
  );
}
