import { PublicNavbar } from "@/components/public/navbar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FCFCFD] text-slate-900 antialiased selection:bg-slate-900 selection:text-white overflow-x-hidden">
      <PublicNavbar />
      <main className="overflow-x-hidden">{children}</main>
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-[1280px] 2xl:max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="h-6 w-6 rounded-full bg-slate-900 shrink-0" />
              <span className="text-sm font-medium tracking-tight">PT BUMI SURYA FARM</span>
              <span className="text-sm text-slate-400">— 2026</span>
            </div>
            <div className="text-xs tracking-wide text-slate-400 leading-relaxed">Minimal • White • Slate • Emerald accent • Built for traceability</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
