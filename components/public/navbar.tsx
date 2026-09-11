"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Leaf, Menu, X, ChevronDown, Building2, Users, FileCheck, MapPinned, Sprout, ScanLine, Package, Award, Phone } from "lucide-react";

type Sub = { label: string; href: string; desc: string; icon: any };
const menus: { label: string; href?: string; subs?: Sub[] }[] = [
  { label: "Beranda", href: "/" },
  {
    label: "Perusahaan",
    subs: [
      { label: "Tentang Kami", href: "/#tentang", desc: "Profil & sejarah", icon: Building2 },
      { label: "Visi & Misi", href: "/#tentang", desc: "Tujuan berkelanjutan", icon: Award },
      { label: "Manajemen", href: "/#tentang", desc: "Struktur organisasi", icon: Users },
      { label: "Legalitas", href: "/#tentang", desc: "RSPO • ISPO", icon: FileCheck },
    ],
  },
  {
    label: "Operasional",
    subs: [
      { label: "Manajemen Pohon", href: "/#qr", desc: "ID PHN-BLK-XXX", icon: Sprout },
      { label: "QR Traceability", href: "/#qr", desc: "Scan tanpa aplikasi", icon: ScanLine },
      { label: "Lahan & Blok", href: "/#qr", desc: "120 Ha • Blok A–D", icon: MapPinned },
    ],
  },
  {
    label: "Produk",
    subs: [
      { label: "TBS Sawit", href: "/#produk", desc: "DxP • Premium", icon: Package },
      { label: "Bibit Unggul", href: "/#produk", desc: "TN1 bersertifikat", icon: Sprout },
      { label: "Pupuk Organik", href: "/#produk", desc: "Organik Surya Farm", icon: Leaf },
    ],
  },
  { label: "Kontak", href: "/#kontak" },
];

export function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [desktopOpen, setDesktopOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Close desktop dropdown on outside click / Escape - fixes ngrok click not working when overlay remains open
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setDesktopOpen(null);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDesktopOpen(null);
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header ref={navRef} className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-[56px] sm:h-[60px] max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8 gap-2">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-700 text-white shrink-0">
            <Leaf className="h-4 w-4" />
          </div>
          <div className="leading-none">
            <div className="text-[11px] sm:text-[13px] font-semibold tracking-tight text-slate-900">BUMI SURYA</div>
            <div className="text-[9px] sm:text-[10px] font-medium tracking-[0.18em] text-green-800">FARM</div>
          </div>
        </Link>

        {/* Desktop nav - now CLICK based, not hover-only (hover broken on touch/ngrok) */}
        <nav className="hidden items-center gap-1 lg:flex">
          {menus.map((m) =>
            m.subs ? (
              <div key={m.label} className="relative">
                <button
                  type="button"
                  onClick={() => setDesktopOpen(desktopOpen === m.label ? null : m.label)}
                  aria-expanded={desktopOpen === m.label}
                  className="flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer select-none"
                >
                  {m.label} <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${desktopOpen === m.label ? "rotate-180" : ""}`} />
                </button>
                {desktopOpen === m.label && (
                  <div className="absolute left-1/2 top-full -translate-x-1/2 pt-3 z-50">
                    <div className="w-[320px] rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_8px_32px_rgba(16,24,40,0.12)]">
                      {m.subs.map((s) => (
                        <Link
                          key={s.label}
                          href={s.href}
                          onClick={() => setDesktopOpen(null)}
                          className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 active:bg-slate-100 cursor-pointer"
                        >
                          <s.icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900">{s.label}</div>
                            <div className="text-xs text-slate-500 truncate">{s.desc}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link key={m.label} href={m.href!} className="rounded-full px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                {m.label}
              </Link>
            )
          )}
        </nav>

        <div className="hidden items-center gap-2 lg:flex shrink-0">
          <a href="https://wa.me/628123456789" target="_blank" rel="noopener noreferrer" className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2">
            <Phone className="h-3 w-3" /> +62 812
          </a>
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="rounded-full cursor-pointer">
              Masuk
            </Button>
          </Link>
          <Link href="/admin">
            <Button size="sm" className="rounded-full px-4 cursor-pointer">
              Portal
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger - lg hidden (tablet uses hamburger, fixes iPad click) */}
        <button
          type="button"
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          className="lg:hidden p-2 -mr-2 rounded-full hover:bg-slate-50 active:bg-slate-100 cursor-pointer touch-manipulation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer - full width, scrollable, proper z-index for ngrok */}
      {open && (
        <div className="lg:hidden border-t border-slate-100 bg-white max-h-[calc(100dvh-56px)] overflow-auto overscroll-contain">
          <div className="px-4 sm:px-6 py-4 space-y-1">
            {menus.map((m) => (
              <div key={m.label} className="border-b border-slate-50 last:border-0">
                {m.subs ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setOpenSub(openSub === m.label ? null : m.label)}
                      className="flex w-full items-center justify-between py-3.5 text-sm font-medium text-slate-900 cursor-pointer touch-manipulation"
                    >
                      {m.label} <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSub === m.label ? "rotate-180" : ""}`} />
                    </button>
                    {openSub === m.label && (
                      <div className="pb-3 space-y-1">
                        {m.subs.map((s) => (
                          <Link key={s.label} href={s.href} onClick={() => setOpen(false)} className="flex gap-3 rounded-xl bg-slate-50 px-3 py-3 active:bg-slate-100 cursor-pointer">
                            <s.icon className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900">{s.label}</div>
                              <div className="text-xs text-slate-500">{s.desc}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link href={m.href!} onClick={() => setOpen(false)} className="block py-3.5 text-sm font-medium text-slate-900">
                    {m.label}
                  </Link>
                )}
              </div>
            ))}
            <div className="pt-4 flex flex-col gap-2">
              <Link href="/admin" onClick={() => setOpen(false)} className="block">
                <Button className="w-full rounded-full h-11 cursor-pointer">Portal</Button>
              </Link>
              <Link href="/admin" onClick={() => setOpen(false)} className="block">
                <Button variant="outline" className="w-full rounded-full h-11 cursor-pointer">Masuk</Button>
              </Link>
              <a href="https://wa.me/628123456789" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
                <Phone className="h-4 w-4" /> +62 812 3456 789
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
