"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  JURNAL_PERIODE_LABEL,
  type JurnalPeriode,
  type JurnalSnapshot,
  type JurnalVoucher,
} from "@/lib/jurnal-types";

// Halaman utama = DAFTAR dokumen (tanpa nominal). Nominal + tombol unduh
// hanya ada di tampilan DETAIL per dokumen. Seluruh angka memakai snapshot
// dari API yang sama (logic perhitungan tidak diubah di sini).

type ApiData = { mode: "single"; snapshot: JurnalSnapshot };

type Draft = { periode: JurnalPeriode; dari: string; sampai: string };

const PERIODE_OPTIONS = (Object.keys(JURNAL_PERIODE_LABEL) as JurnalPeriode[]).map((v) => ({
  value: v,
  label: JURNAL_PERIODE_LABEL[v],
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

/** Cerminan resolveJurnalRange (server) — hanya untuk mengisi otomatis tanggal awal/akhir. */
function rentangUntuk(periode: JurnalPeriode): { dari: string; sampai: string } | null {
  const now = new Date();
  const today = startOfDay(now);
  switch (periode) {
    case "hari-ini":
      return { dari: toYMD(today), sampai: toYMD(today) };
    case "kemarin": {
      const y = addDays(today, -1);
      return { dari: toYMD(y), sampai: toYMD(y) };
    }
    case "minggu-ini": {
      const dow = (today.getDay() + 6) % 7;
      return { dari: toYMD(addDays(today, -dow)), sampai: toYMD(addDays(today, -dow + 6)) };
    }
    case "minggu-lalu": {
      const dow = (today.getDay() + 6) % 7;
      return { dari: toYMD(addDays(today, -dow - 7)), sampai: toYMD(addDays(today, -dow - 7 + 6)) };
    }
    case "bulan-ini":
      return { dari: toYMD(new Date(now.getFullYear(), now.getMonth(), 1)), sampai: toYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case "bulan-lalu":
      return { dari: toYMD(new Date(now.getFullYear(), now.getMonth() - 1, 1)), sampai: toYMD(new Date(now.getFullYear(), now.getMonth(), 0)) };
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
function fmtTgl(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Judul dokumen: "Jurnal — September 2026" bila satu bulan, else "Jurnal — {label}". */
function judulDokumen(s: JurnalSnapshot) {
  const a = new Date(s.start);
  const b = new Date(s.end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    const nama = a.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    return `Jurnal — ${nama}`;
  }
  return `Jurnal — ${s.label}`;
}

function VoucherCard({ v }: { v: JurnalVoucher }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-1 bg-slate-50 px-4 py-2.5">
        <span className="text-xs font-semibold text-slate-700">
          {v.noTransaksi && <span className="font-mono text-[11px] text-slate-500">{v.noTransaksi}</span>}
          {v.noTransaksi && <span className="mx-1.5 text-slate-300">·</span>}
          {fmtTgl(v.tanggal)}
        </span>
        <span className="max-w-full truncate text-[11px] text-slate-400">{v.uraian}</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-white">
            <TableHead className="text-xs">Akun</TableHead>
            <TableHead className="text-right text-xs">Debit</TableHead>
            <TableHead className="text-right text-xs">Kredit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {v.legs.map((l, i) => (
            <TableRow key={`${l.kode}-${i}`}>
              <TableCell className="text-xs text-slate-600">
                <span className="font-mono text-[11px] text-slate-400">{l.kode}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                {l.nama}
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums text-slate-700">
                {l.debit !== 0 ? rp(l.debit) : <span className="text-slate-300">—</span>}
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums text-slate-700">
                {l.kredit !== 0 ? rp(l.kredit) : <span className="text-slate-300">—</span>}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-slate-50/70">
            <TableCell className="text-xs font-semibold text-slate-900">Total</TableCell>
            <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">{rp(v.totalDebit)}</TableCell>
            <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">{rp(v.totalKredit)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function SnapshotView({ s }: { s: JurnalSnapshot }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
        <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
        <p className="text-sm font-semibold text-slate-900">Jurnal</p>
        <p className="text-xs text-slate-500">{s.label}</p>
        <p className="text-xs text-slate-400">(dalam IDR)</p>
      </div>

      {s.voucher.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">Tidak ada transaksi pada periode ini</p>
          <p className="mt-1 text-xs text-slate-400">Coba pilih periode lain atau persempit rentang tanggal.</p>
        </div>
      ) : (
        <>
          {s.voucher.map((v) => (
            <VoucherCard key={v.id} v={v} />
          ))}
          <div className="flex items-center justify-between rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-3">
            <span className="text-sm font-semibold text-white">Grand Total</span>
            <span className="text-sm font-semibold tabular-nums text-white">
              {rp(s.grandTotalDebit)} <span className="font-normal opacity-70">=</span> {rp(s.grandTotalKredit)}
            </span>
          </div>
        </>
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

export function JurnalContent() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-slate-400">Memuat Jurnal...</p>}>
      <JurnalIsi />
    </Suspense>
  );
}

function JurnalIsi() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = todayYMD();
  const [draft, setDraft] = useState<Draft>({ periode: "bulan-ini", dari: t, sampai: t });
  const [applied, setApplied] = useState<Draft>({ periode: "bulan-ini", dari: t, sampai: t });
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
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
    fetch(`/api/keuangan/laporan/jurnal?${queryDaftar()}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as ApiData);
        } else {
          setError(j?.message || "Gagal memuat Jurnal");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat Jurnal");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryDaftar]);

  const gantiPeriode = (v: JurnalPeriode) => {
    setFilterError("");
    const r = rentangUntuk(v);
    setDraft((d) => ({ ...d, periode: v, dari: r?.dari ?? d.dari, sampai: r?.sampai ?? d.sampai }));
  };

  const gantiTanggal = (key: "dari" | "sampai", value: string) => {
    const next = { ...draft, [key]: value, periode: "custom" as JurnalPeriode };
    if (next.dari && next.sampai && new Date(next.sampai) < new Date(next.dari)) {
      setFilterError("Tanggal akhir tidak boleh lebih awal dari tanggal mulai");
      return;
    }
    setFilterError("");
    setDraft(next);
  };

  const terapkan = () => {
    if (draft.periode === "custom" && (!draft.dari || !draft.sampai)) {
      setFilterError("Isi tanggal awal dan tanggal akhir terlebih dahulu");
      return;
    }
    setFilterError("");
    setApplied(draft);
    // Kembali ke daftar dokumen halaman ini (bukan dashboard laporan).
    if (docIndex !== null) router.push(pathname, { scroll: false });
  };

  const daftar: JurnalSnapshot[] = data?.mode === "single" ? [data.snapshot] : [];
  const aktif = docIndex !== null ? (daftar[docIndex] ?? null) : null;

  const bukaDokumen = (i: number) => {
    router.push(`${pathname}?doc=${i}`, { scroll: false });
  };

  const kembaliKeDaftar = () => {
    setMenuUnduh(false);
    router.push(pathname, { scroll: false });
  };

  const download = async (fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuUnduh(false);
    try {
      const res = await fetch(`/api/keuangan/laporan/jurnal?${queryDaftar()}&format=${fmt}`, {
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
      a.download = m?.[1] ?? `jurnal.${fmt}`;
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
          Detail, PDF, dan XLSX memakai sumber data Jurnal yang sama sehingga angkanya identik.
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
              <label htmlFor="jurnal-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
                Filter sesuai periode
              </label>
              <Select
                id="jurnal-periode"
                value={draft.periode}
                onChange={(e) => gantiPeriode(e.target.value as JurnalPeriode)}
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
                <label htmlFor="jurnal-dari" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Tanggal awal
                </label>
                <Input id="jurnal-dari" type="date" value={draft.dari} onChange={(e) => gantiTanggal("dari", e.target.value)} className="h-10 text-sm" />
              </div>
              <span className="pb-3 text-slate-400">–</span>
              <div>
                <label htmlFor="jurnal-sampai" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Tanggal akhir
                </label>
                <Input id="jurnal-sampai" type="date" value={draft.sampai} onChange={(e) => gantiTanggal("sampai", e.target.value)} className="h-10 text-sm" />
              </div>
            </div>
            <Button
              type="button"
              onClick={terapkan}
              className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800 sm:w-auto"
            >
              Tampilkan
            </Button>
          </div>
          {filterError && <p className="text-xs text-red-600">{filterError}</p>}
        </CardContent>
      </Card>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Memuat Jurnal...</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : daftar.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Tidak ada dokumen Jurnal pada periode ini.</p>
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
