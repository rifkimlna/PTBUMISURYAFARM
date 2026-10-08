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
  BUKU_BESAR_PERIODE_LABEL,
  type BukuBesarAkun,
  type BukuBesarPeriode,
  type BukuBesarSnapshot,
} from "@/lib/buku-besar-types";

// Halaman utama = DAFTAR dokumen (tanpa nominal). Nominal + tombol unduh
// hanya ada di tampilan DETAIL per dokumen. Seluruh angka memakai snapshot
// dari API yang sama (logic perhitungan tidak diubah di sini).

type ApiData =
  | { mode: "single"; snapshot: BukuBesarSnapshot }
  | { mode: "monthly"; snapshots: BukuBesarSnapshot[] };

type Draft = { periode: BukuBesarPeriode; dari: string; sampai: string };

const PERIODE_OPTIONS = (Object.keys(BUKU_BESAR_PERIODE_LABEL) as BukuBesarPeriode[]).map((v) => ({
  value: v,
  label: BUKU_BESAR_PERIODE_LABEL[v],
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

/** Cerminan resolveBukuBesarRange (server) — hanya untuk mengisi otomatis tanggal awal/akhir. */
function rentangUntuk(periode: BukuBesarPeriode): { dari: string; sampai: string } | null {
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
    case "bulan-ini":
      return { dari: toYMD(new Date(now.getFullYear(), now.getMonth(), 1)), sampai: toYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case "triwulan-ini": {
      const q = Math.floor(now.getMonth() / 3);
      return { dari: toYMD(new Date(now.getFullYear(), q * 3, 1)), sampai: toYMD(new Date(now.getFullYear(), q * 3 + 3, 0)) };
    }
    case "tahun-ini":
      return { dari: toYMD(new Date(now.getFullYear(), 0, 1)), sampai: toYMD(new Date(now.getFullYear(), 11, 31)) };
    case "bulan-lalu":
      return { dari: toYMD(new Date(now.getFullYear(), now.getMonth() - 1, 1)), sampai: toYMD(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "kuartal-lalu": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      return { dari: toYMD(new Date(now.getFullYear(), q * 3, 1)), sampai: toYMD(new Date(now.getFullYear(), q * 3 + 3, 0)) };
    }
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

/** Judul dokumen: "Buku Besar — September 2026" bila satu bulan, else "Buku Besar — {label}". */
function judulDokumen(s: BukuBesarSnapshot) {
  const a = new Date(s.start);
  const b = new Date(s.end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    const nama = a.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    return `Buku Besar — ${nama}`;
  }
  return `Buku Besar — ${s.label}`;
}

function AkunCard({ a }: { a: BukuBesarAkun }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-1 bg-slate-50 px-4 py-2.5">
        <span className="text-xs font-semibold text-slate-700">
          <span className="font-mono text-[11px] text-slate-400">{a.kode}</span>
          <span className="mx-1.5 text-slate-300">·</span>
          {a.nama}
        </span>
        <span className="text-[11px] text-slate-400">Saldo normal: {a.saldoNormal === "debit" ? "Debit" : "Kredit"}</span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead className="whitespace-nowrap text-xs">Tanggal</TableHead>
              <TableHead className="text-xs">Transaksi</TableHead>
              <TableHead className="whitespace-nowrap text-xs">Nomor</TableHead>
              <TableHead className="text-xs">Keterangan</TableHead>
              <TableHead className="text-right text-xs">Debit</TableHead>
              <TableHead className="text-right text-xs">Kredit</TableHead>
              <TableHead className="text-right text-xs">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-xs text-slate-400">—</TableCell>
              <TableCell className="text-xs text-slate-500">Saldo awal</TableCell>
              <TableCell className="text-xs text-slate-300">—</TableCell>
              <TableCell className="text-xs text-slate-300">—</TableCell>
              <TableCell className="text-right text-xs text-slate-300">—</TableCell>
              <TableCell className="text-right text-xs text-slate-300">—</TableCell>
              <TableCell className="text-right text-xs tabular-nums text-slate-700">{rp(a.saldoAwal)}</TableCell>
            </TableRow>
            {a.baris.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-4 text-center text-xs text-slate-400">
                  Tidak ada mutasi pada periode ini
                </TableCell>
              </TableRow>
            ) : (
              a.baris.map((b, i) => (
                <TableRow key={`${b.tanggal}-${b.noTransaksi ?? ""}-${i}`}>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">{fmtTgl(b.tanggal)}</TableCell>
                  <TableCell className="max-w-52 text-xs text-slate-600">{b.transaksi}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-[11px] text-slate-500">
                    {b.noTransaksi ?? <span className="font-sans text-slate-300">—</span>}
                  </TableCell>
                  <TableCell className="max-w-64 text-xs text-slate-600">
                    {b.keterangan ? b.keterangan : <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-slate-700">
                    {b.debit !== 0 ? rp(b.debit) : <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-slate-700">
                    {b.kredit !== 0 ? rp(b.kredit) : <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-slate-700">{rp(b.saldo)}</TableCell>
                </TableRow>
              ))
            )}
            <TableRow className="bg-slate-50/70">
              <TableCell colSpan={4} className="text-xs font-semibold text-slate-900">
                Total mutasi {a.kode}
              </TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">{rp(a.totalDebit)}</TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">{rp(a.totalKredit)}</TableCell>
              <TableCell className="text-right text-xs tabular-nums text-slate-300">—</TableCell>
            </TableRow>
            <TableRow className="bg-emerald-50/60">
              <TableCell colSpan={4} className="text-xs font-semibold text-emerald-900">
                Current Balance {a.kode} — {a.nama}
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums text-slate-300">—</TableCell>
              <TableCell className="text-right text-xs tabular-nums text-slate-300">—</TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums text-emerald-900">{rp(a.saldoAkhir)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SnapshotView({ s }: { s: BukuBesarSnapshot }) {
  const grandSaldo = s.akun.reduce((acc, a) => acc + (Number(a.saldoAkhir) || 0), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
        <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
        <p className="text-sm font-semibold text-slate-900">Buku Besar</p>
        <p className="text-xs text-slate-500">{s.label}</p>
        <p className="text-xs text-slate-400">(dalam IDR)</p>
      </div>

      {s.akun.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">Tidak ada mutasi pada periode ini.</p>
      ) : (
        s.akun.map((a) => <AkunCard key={a.kode} a={a} />)
      )}

      {s.akun.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/50">
          <div className="px-4 py-2.5">
            <p className="text-xs font-semibold text-emerald-900">Grand Total — seluruh akun tampil</p>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-emerald-100 px-4 py-3 text-right">
            <div>
              <p className="text-[11px] text-slate-500">Total Debit</p>
              <p className="text-xs font-semibold tabular-nums text-slate-900">{rp(s.totalDebit)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Total Kredit</p>
              <p className="text-xs font-semibold tabular-nums text-slate-900">{rp(s.totalKredit)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Grand Total Saldo</p>
              <p className="text-xs font-semibold tabular-nums text-emerald-900">{rp(grandSaldo)}</p>
            </div>
          </div>
        </div>
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

export function BukuBesarContent() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-slate-400">Memuat Buku Besar...</p>}>
      <BukuBesarIsi />
    </Suspense>
  );
}

function BukuBesarIsi() {
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

  // Dokumen yang dibuka disinkron ke URL (?doc=i) agar tombol kembali —
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
    fetch(`/api/keuangan/laporan/buku-besar?${queryDaftar()}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as ApiData);
        } else {
          setError(j?.message || "Gagal memuat Buku Besar");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat Buku Besar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryDaftar]);

  const gantiPeriode = (v: BukuBesarPeriode) => {
    setFilterError("");
    const r = rentangUntuk(v);
    setDraft((d) => ({ ...d, periode: v, dari: r?.dari ?? d.dari, sampai: r?.sampai ?? d.sampai }));
  };

  const gantiTanggal = (key: "dari" | "sampai", value: string) => {
    const next = { ...draft, [key]: value, periode: "custom" as BukuBesarPeriode };
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

  const daftar: BukuBesarSnapshot[] =
    data?.mode === "monthly"
      ? data.snapshots
      : data?.mode === "single"
        ? [data.snapshot]
        : [];
  const aktif = docIndex !== null ? (daftar[docIndex] ?? null) : null;

  const bukaDokumen = (i: number) => {
    router.push(`${pathname}?doc=${i}`, { scroll: false });
  };

  const kembaliKeDaftar = () => {
    setMenuUnduh(false);
    router.push(pathname, { scroll: false });
  };

  const download = async (s: BukuBesarSnapshot, fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuUnduh(false);
    try {
      // Unduhan mengikuti periode dokumen yang dibuka (mode bulanan → custom bulan tsb).
      let q = queryDaftar();
      if (data?.mode === "monthly") {
        const d = new Date(s.start);
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const e = new Date(s.end);
        const ymdE = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
        q = new URLSearchParams({ periode: "custom", dari: ymd, sampai: ymdE }).toString();
      }
      const res = await fetch(`/api/keuangan/laporan/buku-besar?${q}&format=${fmt}`, {
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
      a.download = m?.[1] ?? `buku-besar.${fmt}`;
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
                    onClick={() => download(aktif, "pdf")}
                    className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4 text-slate-400" />
                    {dl === "pdf" ? "Menyiapkan PDF..." : "Download PDF"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={dl !== null}
                    onClick={() => download(aktif, "xlsx")}
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
          Detail, PDF, dan XLSX memakai sumber data Buku Besar yang sama sehingga angkanya identik.
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
              <label htmlFor="bukubesar-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
                Filter sesuai periode
              </label>
              <Select
                id="bukubesar-periode"
                value={draft.periode}
                onChange={(e) => gantiPeriode(e.target.value as BukuBesarPeriode)}
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
                <label htmlFor="bukubesar-dari" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Tanggal awal
                </label>
                <Input id="bukubesar-dari" type="date" value={draft.dari} onChange={(e) => gantiTanggal("dari", e.target.value)} className="h-10 text-sm" />
              </div>
              <span className="pb-3 text-slate-400">–</span>
              <div>
                <label htmlFor="bukubesar-sampai" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Tanggal akhir
                </label>
                <Input id="bukubesar-sampai" type="date" value={draft.sampai} onChange={(e) => gantiTanggal("sampai", e.target.value)} className="h-10 text-sm" />
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
        <p className="py-10 text-center text-sm text-slate-400">Memuat Buku Besar...</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : daftar.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Tidak ada dokumen Buku Besar pada periode ini.</p>
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
