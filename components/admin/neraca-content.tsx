"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  NERACA_PERIODE_LABEL,
  type NeracaPeriode,
  type NeracaSnapshot,
} from "@/lib/neraca-types";

// Tampilan tunggal ala Daftar Pembelian: kartu filter di atas, isi laporan
// langsung di bawahnya (tanpa daftar dokumen / tombol "Lihat Laporan").
// Seluruh angka memakai snapshot dari API yang sama
// (logic perhitungan tidak diubah di sini).

type ApiData =
  | { mode: "single"; snapshot: NeracaSnapshot }
  | { mode: "monthly"; snapshots: NeracaSnapshot[] };

const PERIODE_OPTIONS = (Object.keys(NERACA_PERIODE_LABEL) as NeracaPeriode[]).map((v) => ({
  value: v,
  label: NERACA_PERIODE_LABEL[v],
}));

// "tahun-ini" dan "per-bulan-tahun-ini" sama-sama memakai daftar bulanan
// dari API (satu sumber logic: getNeracaBulanan).
function isDaftarBulanan(periode: NeracaPeriode) {
  return periode === "tahun-ini" || periode === "per-bulan-tahun-ini";
}

function todayYMD() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Cerminan resolveNeracaRange (server) — mengisi otomatis tanggal awal/akhir. */
function rentangUntuk(periode: NeracaPeriode): { dari: string; sampai: string } | null {
  const now = new Date();
  const today = startOfDay(now);
  switch (periode) {
    case "hari-ini":
      return { dari: toYMD(today), sampai: toYMD(today) };
    case "kemarin": {
      const y = addDays(today, -1);
      return { dari: toYMD(y), sampai: toYMD(y) };
    }
    case "pekan-ini": {
      const dow = (today.getDay() + 6) % 7;
      return { dari: toYMD(addDays(today, -dow)), sampai: toYMD(addDays(today, -dow + 6)) };
    }
    case "pekan-lalu": {
      const dow = (today.getDay() + 6) % 7;
      return { dari: toYMD(addDays(today, -dow - 7)), sampai: toYMD(addDays(today, -dow - 7 + 6)) };
    }
    case "bulan-ini":
      return { dari: toYMD(new Date(now.getFullYear(), now.getMonth(), 1)), sampai: toYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case "bulan-lalu":
      return { dari: toYMD(new Date(now.getFullYear(), now.getMonth() - 1, 1)), sampai: toYMD(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "kuartal-ini": {
      const q = Math.floor(now.getMonth() / 3);
      return { dari: toYMD(new Date(now.getFullYear(), q * 3, 1)), sampai: toYMD(new Date(now.getFullYear(), q * 3 + 3, 0)) };
    }
    case "kuartal-lalu": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      return { dari: toYMD(new Date(now.getFullYear(), q * 3, 1)), sampai: toYMD(new Date(now.getFullYear(), q * 3 + 3, 0)) };
    }
    case "tahun-ini":
    case "per-bulan-tahun-ini":
      return { dari: toYMD(new Date(now.getFullYear(), 0, 1)), sampai: toYMD(today) };
    default:
      return null;
  }
}

function rp(v: number) {
  return `Rp ${formatRupiah(v)}`;
}

function KelompokCard({
  kelompok,
  pengurang = false,
}: {
  kelompok: NeracaSnapshot["aktivaLancar"];
  pengurang?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700">{kelompok.judul}</div>
      <Table>
        <TableBody>
          {kelompok.baris.length === 0 ? (
            <TableRow>
              <TableCell className="py-4 text-center text-xs text-slate-400">
                Tidak ada akun pada periode ini
              </TableCell>
            </TableRow>
          ) : (
            kelompok.baris.map((b) => (
              <TableRow key={`${b.kode}-${b.nama}`}>
                <TableCell className="text-xs text-slate-600">
                  <span className="font-mono text-[11px] text-slate-400">{b.kode}</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  {b.nama}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums text-slate-700">
                  {pengurang ? `(${rp(Math.abs(b.nilai))})` : rp(b.nilai)}
                </TableCell>
              </TableRow>
            ))
          )}
          <TableRow className="bg-slate-50/70">
            <TableCell className="text-xs font-semibold text-slate-900">
              Total {kelompok.judul}
            </TableCell>
            <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
              {pengurang ? `(${rp(Math.abs(kelompok.total))})` : rp(kelompok.total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function TotalRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
        strong ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white"
      }`}
    >
      <span className={`text-sm font-semibold ${strong ? "text-white" : "text-slate-900"}`}>{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${strong ? "text-white" : "text-slate-900"}`}>
        {rp(value)}
      </span>
    </div>
  );
}

function SnapshotView({ s }: { s: NeracaSnapshot }) {
  const seimbang = Math.round(s.selisih) === 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
        <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
        <p className="text-sm font-semibold text-slate-900">Neraca</p>
        <p className="text-xs text-slate-500">{s.label}</p>
        <p className="text-xs text-slate-400">(dalam IDR)</p>
        <span
          className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
            seimbang ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {seimbang ? "Seimbang: Total Aktiva = Total Kewajiban dan Modal" : "Selisih: periksa data"}
        </span>
      </div>

      <h2 className="text-sm font-semibold text-slate-900">AKTIVA</h2>
      <KelompokCard kelompok={s.aktivaLancar} />
      <KelompokCard kelompok={s.aktivaTetap} />
      <KelompokCard kelompok={s.penyusutan} pengurang />
      <TotalRow label="Total Aktiva" value={s.totalAktiva} strong />

      <h2 className="pt-2 text-sm font-semibold text-slate-900">KEWAJIBAN DAN MODAL</h2>
      <KelompokCard kelompok={s.kewajibanLancar} />
      <TotalRow label="Total Kewajiban" value={s.totalKewajiban} />
      <KelompokCard kelompok={s.modal} />
      <TotalRow label="Total Modal Pemilik" value={s.totalModal} />
      <TotalRow label="Total Kewajiban dan Modal" value={s.totalKewajibanModal} strong />

      {Math.round(s.selisih) !== 0 && (
        <TotalRow
          label="Selisih (Aktiva − Kewajiban − Modal)"
          value={s.selisih}
          strong
        />
      )}

      {s.catatan.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800">Catatan</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-amber-800">
            {s.catatan.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type Draft = { periode: NeracaPeriode; dari: string; sampai: string };

function draftAwal(): Draft {
  const r = rentangUntuk("bulan-ini");
  return { periode: "bulan-ini", dari: r?.dari ?? todayYMD(), sampai: r?.sampai ?? todayYMD() };
}

export function NeracaContent() {
  const [draft, setDraft] = useState<Draft>(draftAwal);
  const [applied, setApplied] = useState<Draft>(draftAwal);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [menuUnduh, setMenuUnduh] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  // Query daftar: periode bulanan selalu memakai endpoint bulanan yang sama.
  // Neraca adalah laporan posisi: angka dihitung kumulatif s/d tanggal akhir.
  const queryDaftar = useCallback(() => {
    if (isDaftarBulanan(applied.periode)) return "periode=per-bulan-tahun-ini";
    const p = new URLSearchParams({ periode: applied.periode });
    if (applied.periode === "custom") {
      p.set("dari", applied.dari);
      p.set("sampai", applied.sampai);
    }
    return p.toString();
  }, [applied]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/keuangan/laporan/neraca?${queryDaftar()}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as ApiData);
        } else {
          setError(j?.message || "Gagal memuat Neraca");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat Neraca");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryDaftar]);

  const gantiPeriode = (v: NeracaPeriode) => {
    setFilterError("");
    const r = rentangUntuk(v);
    setDraft((d) => (r ? { periode: v, dari: r.dari, sampai: r.sampai } : { ...d, periode: v }));
  };

  const terapkanFilter = () => {
    if (!draft.dari || !draft.sampai) {
      setFilterError("Isi tanggal awal dan tanggal akhir terlebih dahulu");
      return;
    }
    if (new Date(draft.sampai) < new Date(draft.dari)) {
      setFilterError("Tanggal akhir tidak boleh lebih awal dari tanggal awal");
      return;
    }
    setFilterError("");
    setApplied(draft);
  };

  const daftar: NeracaSnapshot[] =
    data?.mode === "monthly"
      ? data.snapshots
      : data?.mode === "single"
        ? [data.snapshot]
        : [];

  // Unduhan memakai query filter aktif yang sama dengan tampilan
  // (mode bulanan mengunduh seluruh snapshot sekaligus).
  const download = async (fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuUnduh(false);
    try {
      const res = await fetch(`/api/keuangan/laporan/neraca?${queryDaftar()}&format=${fmt}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || "Gagal mengunduh file");
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = m?.[1] ?? `neraca.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunduh file");
    } finally {
      setDl(null);
    }
  };

  // Tampilan tunggal ala Daftar Pembelian: filter di atas, isi laporan
  // langsung di bawahnya (tanpa daftar dokumen / tombol "Lihat Laporan").
  return (
    <div className="space-y-5">
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-sm">Filter Laporan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label htmlFor="neraca-dari" className="mb-1.5 block text-xs font-medium text-slate-600">
                Tanggal awal
              </label>
              <Input
                id="neraca-dari"
                type="date"
                value={draft.dari}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, dari: e.target.value }));
                  setFilterError("");
                }}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label htmlFor="neraca-sampai" className="mb-1.5 block text-xs font-medium text-slate-600">
                Tanggal akhir
              </label>
              <Input
                id="neraca-sampai"
                type="date"
                value={draft.sampai}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, sampai: e.target.value }));
                  setFilterError("");
                }}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label htmlFor="neraca-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
                Periode
              </label>
              <Select
                id="neraca-periode"
                value={draft.periode}
                onChange={(e) => gantiPeriode(e.target.value as NeracaPeriode)}
                aria-label="Periode"
              >
                {PERIODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                onClick={terapkanFilter}
                className="w-full cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
              >
                Filter
              </Button>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMenuUnduh((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuUnduh}
                  className="cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Ekspor
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {menuUnduh && (
                  <>
                    <button
                      type="button"
                      aria-label="Tutup menu unduhan"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setMenuUnduh(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={dl !== null}
                        onClick={() => download("pdf")}
                        className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <FileText className="h-4 w-4 text-slate-400" />
                        {dl === "pdf" ? "Menyiapkan PDF..." : "Download PDF"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={dl !== null}
                        onClick={() => download("xlsx")}
                        className="flex w-full cursor-pointer items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                        {dl === "xlsx" ? "Menyiapkan XLSX..." : "Download XLSX"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {filterError && <p className="text-xs text-red-600">{filterError}</p>}
        </CardContent>
      </Card>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Memuat laporan...</p>
      ) : daftar.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 sm:p-6">
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">Tidak ada transaksi pada periode ini</p>
              <p className="mt-1 text-xs text-slate-500">
                Silakan pilih tanggal atau periode lain, lalu klik tombol Filter.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        daftar.map((s) => (
          <Card key={s.label} className="border-slate-200">
            <CardContent className="p-5 sm:p-6">
              <SnapshotView key={s.label} s={s} />
            </CardContent>
          </Card>
        ))
      )}

      <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-400">
        <Download className="h-3.5 w-3.5 shrink-0" />
        Tabel, PDF, dan XLSX memakai sumber data Neraca yang sama sehingga angkanya identik.
      </p>
    </div>
  );
}
