"use client";
import Link from "next/link";
import { useState } from "react";
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
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-[1120px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-700 text-white">
            <Leaf className="h-4 w-4" />
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-semibold tracking-tight text-slate-900">BUMI SURYA</div>
            <div className="text-[10px] font-medium tracking-[0.18em] text-green-800">FARM</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {menus.map((m) =>
            m.subs ? (
              <div key={m.label} className="relative group">
                <button className="flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                  {m.label} <ChevronDown className="h-3 w-3 opacity-40 group-hover:rotate-180 transition" />
                </button>
                <div className="absolute left-1/2 top-full hidden -translate-x-1/2 pt-3 group-hover:block">
                  <div className="w-[300px] rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_8px_24px_rgba(16,24,40,0.06)]">
                    {m.subs.map((s) => (
                      <Link key={s.label} href={s.href} className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                        <s.icon className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-slate-900">{s.label}</div>
                          <div className="text-xs text-slate-500">{s.desc}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link key={m.label} href={m.href!} className="rounded-full px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                {m.label}
              </Link>
            )
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a href="https://wa.me/628123456789" target="_blank" className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
            <Phone className="h-3 w-3" /> +62 812
          </a>
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="rounded-full">
              Masuk
            </Button>
          </Link>
          <Link href="/admin">
            <Button size="sm" className="rounded-full px-4">
              Portal
            </Button>
          </Link>
        </div>

        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-white md:hidden max-h-[80vh] overflow-auto">
          <div className="px-6 py-4 space-y-1">
            {menus.map((m) => (
              <div key={m.label} className="border-b border-slate-50 last:border-0">
                {m.subs ? (
                  <>
                    <button
                      onClick={() => setOpenSub(openSub === m.label ? null : m.label)}
                      className="flex w-full items-center justify-between py-3 text-sm font-medium"
                    >
                      {m.label} <ChevronDown className={`h-4 w-4 text-slate-400 ${openSub === m.label ? "rotate-180" : ""}`} />
                    </button>
                    {openSub === m.label && (
                      <div className="pb-3 space-y-1">
                        {m.subs.map((s) => (
                          <Link key={s.label} href={s.href} onClick={() => setOpen(false)} className="flex gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                            <s.icon className="h-4 w-4 text-slate-500" />
                            <div>
                              <div className="text-sm font-medium">{s.label}</div>
                              <div className="text-xs text-slate-500">{s.desc}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link href={m.href!} onClick={() => setOpen(false)} className="block py-3 text-sm font-medium">
                    {m.label}
                  </Link>
                )}
              </div>
            ))}
            <Link href="/admin" onClick={() => setOpen(false)} className="mt-4 block">
              <Button className="w-full rounded-full">Portal</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
