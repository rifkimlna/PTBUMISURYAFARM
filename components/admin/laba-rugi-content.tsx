"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ArrowLeft, ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  LABA_RUGI_PERIODE_LABEL,
  type LabaRugiPeriode,
  type LabaRugiSnapshot,
} from "@/lib/laba-rugi-types";

// Halaman utama = DAFTAR dokumen (tanpa nominal). Nominal + tombol unduh
// hanya ada di tampilan DETAIL per dokumen. Seluruh angka memakai snapshot
// dari API yang sama (logic perhitungan tidak diubah di sini).

type ApiData =
  | { mode: "single"; snapshot: LabaRugiSnapshot }
  | { mode: "monthly"; snapshots: LabaRugiSnapshot[] };

const PERIODE_OPTIONS = (Object.keys(LABA_RUGI_PERIODE_LABEL) as LabaRugiPeriode[]).map((v) => ({
  value: v,
  label: LABA_RUGI_PERIODE_LABEL[v],
}));

function todayYMD() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function ymdLokal(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function rp(v: number) {
  return `Rp ${formatRupiah(v)}`;
}

/** Judul dokumen: "Laba Rugi — September 2026" bila satu bulan, else "Laba Rugi — {label}". */
function judulDokumen(s: LabaRugiSnapshot) {
  const a = new Date(s.start);
  const b = new Date(s.end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    const nama = a.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    return `Laba Rugi — ${nama}`;
  }
  return `Laba Rugi — ${s.label}`;
}

function KelompokCard({ kelompok }: { kelompok: LabaRugiSnapshot["penjualan"] }) {
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
                <TableCell className="text-right text-xs tabular-nums text-slate-700">{rp(b.nilai)}</TableCell>
              </TableRow>
            ))
          )}
          <TableRow className="bg-slate-50/70">
            <TableCell className="text-xs font-semibold text-slate-900">Total {kelompok.judul}</TableCell>
            <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
              {rp(kelompok.total)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function BarisNilai({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
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

function SnapshotView({ s }: { s: LabaRugiSnapshot }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
        <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
        <p className="text-sm font-semibold text-slate-900">Laba Rugi</p>
        <p className="text-xs text-slate-500">{s.label}</p>
        <p className="text-xs text-slate-400">(dalam IDR)</p>
      </div>

      <h2 className="text-sm font-semibold text-slate-900">PENDAPATAN</h2>
      <KelompokCard kelompok={s.penjualan} />
      <BarisNilai label="Penjualan" value={s.penjualan.total} />
      <BarisNilai label="Diskon Penjualan" value={-s.diskonPenjualan} />
      <BarisNilai label="Retur Penjualan" value={-s.returPenjualan} />
      <BarisNilai label="Total Pendapatan dari Penjualan" value={s.totalPendapatan} />

      <h2 className="pt-2 text-sm font-semibold text-slate-900">HARGA POKOK PENJUALAN</h2>
      <KelompokCard kelompok={s.hpp} />
      <BarisNilai label="Diskon Pembelian" value={-s.diskonPembelian} />
      <BarisNilai label="Total Harga Pokok Penjualan" value={s.totalHpp} />
      <BarisNilai label="Laba Kotor" value={s.labaKotor} strong />

      <h2 className="pt-2 text-sm font-semibold text-slate-900">BIAYA OPERASIONAL</h2>
      <KelompokCard kelompok={s.biayaOperasional} />
      <BarisNilai label="Total Biaya" value={s.totalBiayaOperasional} />
      <BarisNilai label="Pendapatan Bersih Operasional" value={s.operasionalBersih} />

      <h2 className="pt-2 text-sm font-semibold text-slate-900">PENDAPATAN LAINNYA</h2>
      <KelompokCard kelompok={s.pendapatanLainnya} />
      <BarisNilai label="Total Pendapatan Lainnya" value={s.totalPendapatanLainnya} />

      <h2 className="pt-2 text-sm font-semibold text-slate-900">BIAYA LAINNYA</h2>
      <KelompokCard kelompok={s.biayaLainnya} />
      <BarisNilai label="Total Biaya Lainnya" value={s.totalBiayaLainnya} />

      <BarisNilai label="Pendapatan Bersih / Laba Bersih" value={s.labaBersih} strong />
      <BarisNilai
        label="Total Pendapatan Komprehensif untuk Periode Ini"
        value={s.totalKomprehensif}
        strong
      />

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

export function LabaRugiContent() {
  const [applied, setApplied] = useState<{ periode: LabaRugiPeriode; dari: string; sampai: string }>({
    periode: "bulan-ini",
    dari: todayYMD(),
    sampai: todayYMD(),
  });
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [pilihan, setPilihan] = useState<number | null>(null);
  const [menuUnduh, setMenuUnduh] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

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
    fetch(`/api/keuangan/laporan/laba-rugi?${queryDaftar()}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as ApiData);
          setPilihan(null);
        } else {
          setError(j?.message || "Gagal memuat daftar Laba Rugi");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat daftar Laba Rugi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryDaftar]);

  // Filter langsung teraplikasi setiap ada perubahan (tanpa tombol Filter).
  const gantiPeriode = (v: LabaRugiPeriode) => {
    setFilterError("");
    setApplied((a) => ({ ...a, periode: v }));
  };

  const gantiTanggal = (key: "dari" | "sampai", value: string) => {
    const next = { ...applied, [key]: value };
    if (next.dari && next.sampai && new Date(next.sampai) < new Date(next.dari)) {
      setFilterError("Tanggal akhir tidak boleh lebih awal dari tanggal mulai");
      return;
    }
    setFilterError("");
    setApplied(next);
  };

  const daftar: LabaRugiSnapshot[] =
    data?.mode === "monthly"
      ? data.snapshots
      : data?.mode === "single"
        ? [data.snapshot]
        : [];
  const aktif = pilihan !== null ? (daftar[pilihan] ?? null) : null;

  // Query unduhan SELALU menunjuk ke periode dokumen yang sedang dibuka.
  const queryDokumen = useCallback(
    (s: LabaRugiSnapshot) => {
      if (data?.mode === "monthly") {
        const p = new URLSearchParams({
          periode: "custom",
          dari: ymdLokal(s.start),
          sampai: ymdLokal(s.end),
        });
        return p.toString();
      }
      return queryDaftar();
    },
    [data, queryDaftar]
  );

  const download = async (s: LabaRugiSnapshot, fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuUnduh(false);
    try {
      const res = await fetch(`/api/keuangan/laporan/laba-rugi?${queryDokumen(s)}&format=${fmt}`, {
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
      a.download = m?.[1] ?? `laba-rugi.${fmt}`;
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
          Detail, PDF, dan XLSX memakai sumber data Laba Rugi yang sama sehingga angkanya identik.
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
              <label htmlFor="labarugi-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
                Filter sesuai periode
              </label>
              <Select
                id="labarugi-periode"
                value={applied.periode}
                onChange={(e) => gantiPeriode(e.target.value as LabaRugiPeriode)}
                aria-label="Filter sesuai periode"
              >
                {PERIODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            {applied.periode === "custom" && (
              <div className="flex items-end gap-2">
                <div>
                  <label htmlFor="labarugi-dari" className="mb-1.5 block text-xs font-medium text-slate-600">
                    Tanggal mulai
                  </label>
                  <Input id="labarugi-dari" type="date" value={applied.dari} onChange={(e) => gantiTanggal("dari", e.target.value)} className="h-10 text-sm" />
                </div>
                <span className="pb-3 text-slate-400">–</span>
                <div>
                  <label htmlFor="labarugi-sampai" className="mb-1.5 block text-xs font-medium text-slate-600">
                    Tanggal akhir
                  </label>
                  <Input id="labarugi-sampai" type="date" value={applied.sampai} onChange={(e) => gantiTanggal("sampai", e.target.value)} className="h-10 text-sm" />
                </div>
              </div>
            )}
          </div>
          {filterError && <p className="text-xs text-red-600">{filterError}</p>}
        </CardContent>
      </Card>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Memuat daftar Laba Rugi...</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : daftar.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Tidak ada dokumen Laba Rugi pada periode ini.</p>
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
