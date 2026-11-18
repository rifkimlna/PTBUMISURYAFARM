import Link from "next/link";
import { MapPin, Phone, Mail, ScanLine } from "lucide-react";

const kolom = [
  {
    judul: "Perusahaan",
    links: [
      { label: "Tentang Kami", href: "/#tentang" },
      { label: "Visi & Misi", href: "/#tentang" },
      { label: "Manajemen", href: "/#tentang" },
      { label: "Legalitas", href: "/#tentang" },
      { label: "Karir", href: "/karir" },
    ],
  },
  {
    judul: "Operasional",
    links: [
      { label: "Scan QR Pohon", href: "/scan" },
      { label: "Manajemen Pohon", href: "/#qr" },
      { label: "QR Traceability", href: "/#qr" },
      { label: "Lahan & Blok", href: "/#qr" },
    ],
  },
  {
    judul: "Produk",
    links: [
      { label: "Durian Premium", href: "/#produk" },
      { label: "Alpukat Mentega", href: "/#produk" },
      { label: "Jambu Kristal", href: "/#produk" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="bg-green-800 text-white">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-3">
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Logo Bumi Surya Farm" className="h-8 w-auto max-w-[130px] object-contain" />
            </Link>
            <p className="text-sm text-white/70 max-w-xs leading-relaxed">
              PT Bumi Surya Farm — pengelolaan perkebunan 120 Ha (Blok A–D)
              dengan standar GAP & organik, didukung traceability QR pohon.
            </p>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> Indonesia
              </li>
              <li>
                <a href="https://wa.me/628123456789" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> +62 812 3456 789
                </a>
              </li>
              <li>
                <a href="mailto:info@bumisuryafarm.co.id" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> info@bumisuryafarm.co.id
                </a>
              </li>
            </ul>
          </div>

          {/* Kolom link */}
          {kolom.map((k) => (
            <div key={k.judul}>
              <h3 className="text-sm font-semibold mb-3">{k.judul}</h3>
              <ul className="space-y-2 text-sm text-white/70">
                {k.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-white/15 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-white/60">
          <span>© 2026 PT Bumi Surya Farm. Seluruh hak cipta.</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/scan" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <ScanLine className="h-3.5 w-3.5" /> Scan QR
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
