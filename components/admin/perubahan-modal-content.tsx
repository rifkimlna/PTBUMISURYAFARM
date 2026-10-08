"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  PERUBAHAN_MODAL_PERIODE_LABEL,
  type PerubahanModalPeriode,
  type PerubahanModalSnapshot,
} from "@/lib/perubahan-modal-types";

// Halaman utama = DAFTAR dokumen (tanpa nominal). Nominal + tombol unduh
// hanya ada di tampilan DETAIL per dokumen. Seluruh angka memakai snapshot
// dari API yang sama (logic perhitungan tidak diubah di sini).

type ApiData = { mode: "single"; snapshot: PerubahanModalSnapshot };

type Draft = { periode: PerubahanModalPeriode; tanggal: string };

const PERIODE_OPTIONS = (Object.keys(PERUBAHAN_MODAL_PERIODE_LABEL) as PerubahanModalPeriode[]).map((v) => ({
  value: v,
  label: PERUBAHAN_MODAL_PERIODE_LABEL[v],
}));

function todayYMD() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Akuntansi: negatif dalam kurung. */
function rp(v: number) {
  const n = Math.round(Number(v) || 0);
  if (n < 0) return `(Rp ${formatRupiah(Math.abs(n))})`;
  return `Rp ${formatRupiah(n)}`;
}

/** Judul dokumen: "Perubahan Modal — September 2026" bila satu bulan, else "Perubahan Modal — {label}". */
function judulDokumen(s: PerubahanModalSnapshot) {
  const a = new Date(s.start);
  const b = new Date(s.end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    const nama = a.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    return `Perubahan Modal — ${nama}`;
  }
  return `Perubahan Modal — ${s.label}`;
}

function Ringkasan({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
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

function SnapshotView({ s }: { s: PerubahanModalSnapshot }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
        <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
        <p className="text-sm font-semibold text-slate-900">Perubahan Modal</p>
        <p className="text-xs text-slate-500">{s.label}</p>
        <p className="text-xs text-slate-400">(dalam IDR)</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-xs">Kode Akun</TableHead>
              <TableHead className="text-xs">Nama Akun</TableHead>
              <TableHead className="text-right text-xs">Permulaan</TableHead>
              <TableHead className="text-right text-xs">Debit</TableHead>
              <TableHead className="text-right text-xs">Kredit</TableHead>
              <TableHead className="text-right text-xs">Saldo Akhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.baris.map((b) => (
              <TableRow key={b.kode}>
                <TableCell className="font-mono text-[11px] text-slate-500">{b.kode}</TableCell>
                <TableCell className="text-xs text-slate-700">{b.nama}</TableCell>
                <TableCell className="text-right text-xs tabular-nums text-slate-700">{rp(b.permulaan)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums text-slate-700">{rp(b.debit)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums text-slate-700">{rp(b.kredit)}</TableCell>
                <TableCell className="text-right text-xs font-medium tabular-nums text-slate-900">
                  {rp(b.saldoAkhir)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-slate-50/70">
              <TableCell colSpan={2} className="text-xs font-semibold text-slate-900">
                Total
              </TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                {rp(s.totalPermulaan)}
              </TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                {rp(s.totalDebit)}
              </TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                {rp(s.totalKredit)}
              </TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                {rp(s.totalSaldoAkhir)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2">
        <Ringkasan label="Total Modal Permulaan" value={s.totalPermulaan} />
        <Ringkasan label="Pergerakan (Kredit − Debit)" value={s.totalPergerakan} />
        <Ringkasan label="Total Modal Akhir" value={s.totalSaldoAkhir} strong />
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

export function PerubahanModalContent() {
  const [draft, setDraft] = useState<Draft>({ periode: "bulan-ini", tanggal: todayYMD() });
  const [applied, setApplied] = useState<Draft>({ periode: "bulan-ini", tanggal: todayYMD() });
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [pilihan, setPilihan] = useState<number | null>(null);
  const [menuUnduh, setMenuUnduh] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  const queryDaftar = useCallback(() => {
    const p = new URLSearchParams({ periode: applied.periode });
    if (applied.periode === "tanggal") {
      p.set("tanggal", applied.tanggal);
      p.set("dari", applied.tanggal);
      p.set("sampai", applied.tanggal);
    }
    return p.toString();
  }, [applied]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/keuangan/laporan/perubahan-modal?${queryDaftar()}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as ApiData);
          setPilihan(null);
        } else {
          setError(j?.message || "Gagal memuat daftar Perubahan Modal");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat daftar Perubahan Modal");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryDaftar]);

  const terapkanFilter = () => {
    if (draft.periode === "tanggal" && !draft.tanggal) {
      setFilterError("Pilih tanggal terlebih dahulu");
      return;
    }
    setFilterError("");
    setApplied(draft);
  };

  const daftar: PerubahanModalSnapshot[] = data?.mode === "single" ? [data.snapshot] : [];
  const aktif = pilihan !== null ? (daftar[pilihan] ?? null) : null;

  const download = async (s: PerubahanModalSnapshot, fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuUnduh(false);
    try {
      const res = await fetch(`/api/keuangan/laporan/perubahan-modal?${queryDaftar()}&format=${fmt}`, {
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
      a.download = m?.[1] ?? `perubahan-modal.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunduh file");
    } finally {
      setDl(null);
    }
    void s;
  };

  // ------------------------- TAMPILAN DETAIL -------------------------
  if (aktif) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPilihan(null);
              setMenuUnduh(false);
            }}
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
          Detail, PDF, dan XLSX memakai sumber data Perubahan Modal yang sama sehingga angkanya identik.
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
              <label htmlFor="perubahan-modal-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
                Filter sesuai periode
              </label>
              <Select
                id="perubahan-modal-periode"
                value={draft.periode}
                onChange={(e) => {
                  setFilterError("");
                  setDraft((d) => ({ ...d, periode: e.target.value as PerubahanModalPeriode }));
                }}
                aria-label="Filter sesuai periode"
              >
                {PERIODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            {draft.periode === "tanggal" && (
              <div>
                <label htmlFor="perubahan-modal-tanggal" className="mb-1.5 block text-xs font-medium text-slate-600">
                  Pilih tanggal
                </label>
                <Input
                  id="perubahan-modal-tanggal"
                  type="date"
                  value={draft.tanggal}
                  onChange={(e) => {
                    setFilterError("");
                    setDraft((d) => ({ ...d, tanggal: e.target.value }));
                  }}
                  className="h-10 text-sm"
                />
              </div>
            )}
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

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Memuat daftar Perubahan Modal...</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : daftar.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Tidak ada dokumen Perubahan Modal pada periode ini.</p>
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
                    onClick={() => setPilihan(i)}
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
