"use client";

import { Fragment, Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  NERACA_SALDO_PERIODE_LABEL,
  type NeracaSaldoPeriode,
  type NeracaSaldoSnapshot,
} from "@/lib/neraca-saldo-types";

// Halaman utama = DAFTAR dokumen (tanpa nominal). Nominal + tombol unduh
// hanya ada di tampilan DETAIL per dokumen. Seluruh angka memakai snapshot
// dari API yang sama (logic perhitungan tidak diubah di sini).

type ApiData = { mode: "single"; snapshot: NeracaSaldoSnapshot };

type Draft = { periode: NeracaSaldoPeriode; dari: string; sampai: string };

const PERIODE_OPTIONS = (Object.keys(NERACA_SALDO_PERIODE_LABEL) as NeracaSaldoPeriode[]).map((v) => ({
  value: v,
  label: NERACA_SALDO_PERIODE_LABEL[v],
}));

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

/** Cerminan resolveNeracaSaldoRange (server) — hanya untuk mengisi otomatis tanggal awal/akhir. */
function rentangUntuk(periode: NeracaSaldoPeriode): { dari: string; sampai: string } | null {
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
      return { dari: toYMD(new Date(now.getFullYear(), 0, 1)), sampai: toYMD(new Date(now.getFullYear(), 11, 31)) };
    case "tahun-lalu":
      return { dari: toYMD(new Date(now.getFullYear() - 1, 0, 1)), sampai: toYMD(new Date(now.getFullYear() - 1, 11, 31)) };
    default:
      return null;
  }
}

function rp(v: number) {
  const n = Math.round(Number(v) || 0);
  if (n < 0) return `(Rp ${formatRupiah(Math.abs(n))})`;
  return `Rp ${formatRupiah(n)}`;
}

/** Judul dokumen: "Neraca Saldo — September 2026" bila satu bulan, else "Neraca Saldo — {label}". */
function judulDokumen(s: NeracaSaldoSnapshot) {
  const a = new Date(s.start);
  const b = new Date(s.end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    const nama = a.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    return `Neraca Saldo — ${nama}`;
  }
  return `Neraca Saldo — ${s.label}`;
}

function Sel6({ v }: { v: number }) {
  return v !== 0 ? (
    <>{rp(v)}</>
  ) : (
    <span className="text-slate-300">—</span>
  );
}

function SnapshotView({ s }: { s: NeracaSaldoSnapshot }) {
  const grup = s.grup?.length ? s.grup : [];
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
        <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
        <p className="text-sm font-semibold text-slate-900">Neraca Saldo</p>
        <p className="text-xs text-slate-500">{s.label}</p>
        <p className="text-xs text-slate-400">(dalam IDR)</p>
        <span
          className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
            s.seimbang ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {s.seimbang ? "Seimbang: Debit = Kredit (awal, gerak, akhir)" : "Selisih: periksa data"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead rowSpan={2} className="min-w-48 align-bottom text-xs">
                Daftar Akun
              </TableHead>
              <TableHead colSpan={2} className="border-l border-slate-200 text-center text-xs">
                Saldo Awal
              </TableHead>
              <TableHead colSpan={2} className="border-l border-slate-200 text-center text-xs">
                Pergerakan
              </TableHead>
              <TableHead colSpan={2} className="border-l border-slate-200 text-center text-xs">
                Saldo Akhir
              </TableHead>
            </TableRow>
            <TableRow className="bg-slate-50">
              <TableHead className="border-l border-slate-200 text-right text-xs">Debit</TableHead>
              <TableHead className="text-right text-xs">Kredit</TableHead>
              <TableHead className="border-l border-slate-200 text-right text-xs">Debit</TableHead>
              <TableHead className="text-right text-xs">Kredit</TableHead>
              <TableHead className="border-l border-slate-200 text-right text-xs">Debit</TableHead>
              <TableHead className="text-right text-xs">Kredit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.baris.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-xs text-slate-400">
                  Tidak ada mutasi pada periode ini
                </TableCell>
              </TableRow>
            ) : (
              grup.map((g) => (
                <Fragment key={`grup-${g.nama}`}>
                  <TableRow className="bg-slate-100/70">
                    <TableCell colSpan={7} className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      {g.nama}
                    </TableCell>
                  </TableRow>
                  {g.baris.map((b) => (
                    <TableRow key={b.kode}>
                      <TableCell className="text-xs text-slate-700">
                        <span className="font-mono text-[11px] text-slate-400">{b.kode}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        {b.nama}
                      </TableCell>
                      <TableCell className="border-l border-slate-100 text-right text-xs tabular-nums text-slate-700">
                        <Sel6 v={b.saldoAwalDebit} />
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-slate-700">
                        <Sel6 v={b.saldoAwalKredit} />
                      </TableCell>
                      <TableCell className="border-l border-slate-100 text-right text-xs tabular-nums text-slate-700">
                        <Sel6 v={b.debit} />
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-slate-700">
                        <Sel6 v={b.kredit} />
                      </TableCell>
                      <TableCell className="border-l border-slate-100 text-right text-xs tabular-nums text-slate-700">
                        <Sel6 v={b.akhirDebit} />
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-slate-700">
                        <Sel6 v={b.akhirKredit} />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50/70">
                    <TableCell className="text-xs font-semibold text-slate-900">Total {g.nama}</TableCell>
                    <TableCell className="border-l border-slate-100 text-right text-xs font-semibold tabular-nums text-slate-900">
                      {rp(g.totalAwalDebit)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                      {rp(g.totalAwalKredit)}
                    </TableCell>
                    <TableCell className="border-l border-slate-100 text-right text-xs font-semibold tabular-nums text-slate-900">
                      {rp(g.totalDebit)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                      {rp(g.totalKredit)}
                    </TableCell>
                    <TableCell className="border-l border-slate-100 text-right text-xs font-semibold tabular-nums text-slate-900">
                      {rp(g.totalAkhirDebit)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                      {rp(g.totalAkhirKredit)}
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))
            )}
            {s.baris.length > 0 && (
              <TableRow className="bg-emerald-50/60">
                <TableCell className="text-xs font-bold text-emerald-900">TOTAL</TableCell>
                <TableCell className="border-l border-emerald-100 text-right text-xs font-bold tabular-nums text-emerald-900">
                  {rp(s.totalAwalDebit)}
                </TableCell>
                <TableCell className="text-right text-xs font-bold tabular-nums text-emerald-900">
                  {rp(s.totalAwalKredit)}
                </TableCell>
                <TableCell className="border-l border-emerald-100 text-right text-xs font-bold tabular-nums text-emerald-900">
                  {rp(s.totalDebit)}
                </TableCell>
                <TableCell className="text-right text-xs font-bold tabular-nums text-emerald-900">
                  {rp(s.totalKredit)}
                </TableCell>
                <TableCell className="border-l border-emerald-100 text-right text-xs font-bold tabular-nums text-emerald-900">
                  {rp(s.totalAkhirDebit)}
                </TableCell>
                <TableCell className="text-right text-xs font-bold tabular-nums text-emerald-900">
                  {rp(s.totalAkhirKredit)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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

export function NeracaSaldoContent() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-slate-400">Memuat Neraca Saldo...</p>}>
      <NeracaSaldoIsi />
    </Suspense>
  );
}

function NeracaSaldoIsi() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = todayYMD();
  const [draft, setDraft] = useState<Draft>({ periode: "bulan-ini", dari: t, sampai: t });
  const [applied, setApplied] = useState<Draft | null>(null);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [menuUnduh, setMenuUnduh] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  // Dokumen yang dibuka disinkron ke URL (?doc=0) agar tombol kembali —
  // baik tombol di halaman maupun back browser — kembali ke daftar
  // dokumen halaman ini, bukan ke dashboard laporan.
  const docParam = searchParams.get("doc");
  const docIndex = docParam !== null && /^\d+$/.test(docParam) ? Number(docParam) : null;

  const queryDaftar = useCallback(() => {
    if (!applied) return "";
    const p = new URLSearchParams({ periode: applied.periode });
    if (applied.periode === "custom") {
      p.set("dari", applied.dari);
      p.set("sampai", applied.sampai);
    }
    return p.toString();
  }, [applied]);

  useEffect(() => {
    if (!applied) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/keuangan/laporan/neraca-saldo?${queryDaftar()}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as ApiData);
        } else {
          setError(j?.message || "Gagal memuat Neraca Saldo");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat Neraca Saldo");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryDaftar, applied]);

  const gantiPeriode = (v: NeracaSaldoPeriode) => {
    setFilterError("");
    const r = rentangUntuk(v);
    setDraft((d) => ({ ...d, periode: v, dari: r?.dari ?? d.dari, sampai: r?.sampai ?? d.sampai }));
  };

  const gantiTanggal = (key: "dari" | "sampai", value: string) => {
    const next = { ...draft, [key]: value, periode: "custom" as NeracaSaldoPeriode };
    if (next.dari && next.sampai && new Date(next.sampai) < new Date(next.dari)) {
      setFilterError("Tanggal akhir tidak boleh lebih awal dari tanggal mulai");
      return;
    }
    setFilterError("");
    setDraft(next);
  };

  const terapkanFilter = () => {
    if (draft.periode === "custom" && (!draft.dari || !draft.sampai)) {
      setFilterError("Isi tanggal awal dan tanggal akhir terlebih dahulu");
      return;
    }
    setFilterError("");
    setApplied(draft);
    // Kembali ke daftar dokumen halaman ini (bukan dashboard laporan).
    if (docIndex !== null) router.push(pathname, { scroll: false });
  };

  const daftar: NeracaSaldoSnapshot[] = data?.mode === "single" ? [data.snapshot] : [];
  const aktif = docIndex !== null ? (daftar[docIndex] ?? null) : null;

  const bukaDokumen = (i: number) => {
    router.push(`${pathname}?doc=${i}`, { scroll: false });
  };

  const kembaliKeDaftar = () => {
    setMenuUnduh(false);
    router.push(pathname, { scroll: false });
  };

  const download = async (fmt: "pdf" | "xlsx") => {
    if (!applied) return;
    setDl(fmt);
    setMenuUnduh(false);
    try {
      const res = await fetch(`/api/keuangan/laporan/neraca-saldo?${queryDaftar()}&format=${fmt}`, {
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
      a.download = m?.[1] ?? `neraca-saldo.${fmt}`;
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

  // ------------------------- TAMPILAN DETAIL -------------------------
  if (aktif) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={kembaliKeDaftar}
            className="w-fit cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke daftar
          </Button>
          <div className="relative">
            <Button
              type="button"
              onClick={() => setMenuUnduh((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuUnduh}
              className="cursor-pointer bg-emerald-700 hover:bg-emerald-800"
            >
              <Download className="h-4 w-4" />
              Download / Ekspor
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

        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        <Card className="border-slate-200">
          <CardContent className="p-5 sm:p-6">
            <SnapshotView key={aktif.label} s={aktif} />
          </CardContent>
        </Card>

        <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-400">
          <Download className="h-3.5 w-3.5 shrink-0" />
          Detail, PDF, dan XLSX memakai sumber data Neraca Saldo yang sama sehingga angkanya identik.
        </p>
      </div>
    );
  }

  // ------------------------- TAMPILAN DAFTAR -------------------------
  return (
    <div className="space-y-5">
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-sm">Filter Periode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="sm:w-64">
              <label htmlFor="neracasaldo-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
                Filter sesuai periode
              </label>
              <Select
                id="neracasaldo-periode"
                value={draft.periode}
                onChange={(e) => gantiPeriode(e.target.value as NeracaSaldoPeriode)}
                aria-label="Filter sesuai periode"
              >
                {PERIODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label htmlFor="neracasaldo-dari" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Tanggal awal
                </label>
                <Input id="neracasaldo-dari" type="date" value={draft.dari} onChange={(e) => gantiTanggal("dari", e.target.value)} className="h-10 text-sm" />
              </div>
              <span className="pb-3 text-slate-400">–</span>
              <div>
                <label htmlFor="neracasaldo-sampai" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Tanggal akhir
                </label>
                <Input id="neracasaldo-sampai" type="date" value={draft.sampai} onChange={(e) => gantiTanggal("sampai", e.target.value)} className="h-10 text-sm" />
              </div>
            </div>
            <Button
              type="button"
              onClick={terapkanFilter}
              className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800 sm:w-auto"
            >
              Filter
            </Button>
          </div>
          {filterError && <p className="text-xs text-red-600">{filterError}</p>}
        </CardContent>
      </Card>

      {applied === null ? (
        <p className="py-10 text-center text-sm text-slate-400">
          Pilih periode lalu tekan Filter untuk menampilkan dokumen Neraca Saldo.
        </p>
      ) : loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Memuat Neraca Saldo...</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : daftar.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Tidak ada dokumen Neraca Saldo pada periode ini.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {daftar.map((s, i) => (
            <Card key={s.label} className="border-slate-200">
              <CardContent className="flex min-h-36 flex-col p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                    <FileText className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">{judulDokumen(s)}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">Periode: {s.label}</p>
                  </div>
                </div>
                <div className="mt-auto pt-4">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => bukaDokumen(i)}
                    className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
                  >
                    Lihat Laporan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
