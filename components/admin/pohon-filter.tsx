"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";

type Props = {
  q: string;
  blok: string;
  status: string;
  blokRows: string[];
  statusList: string[];
};

/**
 * Filter Data Pohon — hemat ruang vertikal di HP:
 * - search bar selalu terlihat (dengan tombol Filter + badge di dalamnya)
 * - opsi blok/status kolapsibel di HP, selalu terbuka di desktop
 */
export function PohonFilter({ q, blok, status, blokRows, statusList }: Props) {
  const [open, setOpen] = useState(false);
  const active = (q ? 1 : 0) + (blok ? 1 : 0) + (status ? 1 : 0);

  return (
    <form method="get" action="/perkebunan/pohon" className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Cari ID / nama / varietas"
          className="pl-10 pr-[132px] sm:pr-[150px] h-12 rounded-full bg-white text-sm"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`md:hidden relative flex items-center gap-1 h-9 px-3 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              open || active > 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
            {active > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">
                {active}
              </span>
            )}
          </button>
          <Button type="submit" className="h-9 rounded-full bg-green-700 hover:bg-green-800 px-4 sm:px-5 text-sm cursor-pointer">
            Cari
          </Button>
        </div>
      </div>

      <div className={`${open ? "grid" : "hidden"} md:grid grid-cols-2 gap-2`}>
        <select
          name="blok"
          defaultValue={blok}
          aria-label="Filter blok"
          className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm cursor-pointer"
        >
          <option value="">Semua blok</option>
          {blokRows.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          aria-label="Filter status"
          className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm cursor-pointer"
        >
          <option value="">Semua status</option>
          {statusList.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>
    </form>
  );
}
