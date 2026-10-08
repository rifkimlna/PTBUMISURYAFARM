"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ArrowLeft, ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { formatRasio } from "@/lib/ringkasan-bisnis-export";
import {
  RINGKASAN_BISNIS_PERIODE_LABEL,
  type RingkasanBisnisPeriode,
  type RingkasanBisnisSnapshot,
} from "@/lib/ringkasan-bisnis-types";

// Halaman utama = DAFTAR dokumen (tanpa nominal). Nominal + tombol unduh
// hanya ada di tampilan DETAIL per dokumen. Seluruh angka memakai snapshot
// dari API yang sama (logic perhitungan tidak diubah di sini).

type ApiData =
  | { mode: "single"; snapshot: RingkasanBisnisSnapshot }
  | { mode: "monthly"; snapshots: RingkasanBisnisSnapshot[] };

const PERIODE_OPTIONS = (Object.keys(RINGKASAN_BISNIS_PERIODE_LABEL) as RingkasanBisnisPeriode[]).map((v) => ({
  value: v,
  label: RINGKASAN_BISNIS_PERIODE_LABEL[v],
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

/** Judul dokumen: "Ringkasan Bisnis — September 2026" bila satu bulan, else "Ringkasan Bisnis — {label}". */
function judulDokumen(s: RingkasanBisnisSnapshot) {
  const a = new Date(s.start);
  const b = new Date(s.end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    const nama = a.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    return `Ringkasan Bisnis — ${nama}`;
  }
  return `Ringkasan Bisnis — ${s.label}`;
}

function SectionCard({
  judul,
  rows,
  totals = [],
}: {
  judul: string;
  rows: { label: string; nilai: number }[];
  totals?: { label: string; nilai: number }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700">{judul}</div>
      <Table>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell className="text-xs text-slate-600">{r.label}</TableCell>
              <TableCell className="text-right text-xs tabular-nums text-slate-700">{rp(r.nilai)}</TableCell>
            </TableRow>
          ))}
          {totals.map((r) => (
            <TableRow key={r.label} className="bg-slate-50/70">
              <TableCell className="text-xs font-semibold text-slate-900">{r.label}</TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-900">
                {rp(r.nilai)}
              </TableCell>
            </TableRow>
          ))}
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

function SnapshotView({ s }: { s: RingkasanBisnisSnapshot }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
        <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
        <p className="text-sm font-semibold text-slate-900">Ringkasan Bisnis</p>
        <p className="text-xs text-slate-500">{s.label}</p>
        <p className="text-xs text-slate-400">(dalam IDR)</p>
      </div>

      <SectionCard
        judul="Laba Rugi"
        rows={[
          { label: "Pendapatan", nilai: s.labaRugi.pendapatan },
          { label: "Harga Pokok Penjualan", nilai: s.labaRugi.hpp },
        ]}
        totals={[
          { label: "Laba Kotor", nilai: s.labaRugi.labaKotor },
          { label: "Biaya Operasional", nilai: s.labaRugi.biayaOperasional },
          { label: "Laba Operasional", nilai: s.labaRugi.labaOperasional },
          { label: "Pendapatan Lainnya", nilai: s.labaRugi.pendapatanLainnya },
          { label: "Biaya Lainnya", nilai: s.labaRugi.biayaLainnya },
          { label: "Keuntungan Bersih / (Rugi)", nilai: s.labaRugi.labaBersih },
        ]}
      />

      <SectionCard
        judul="Neraca"
        rows={[
          { label: "Aset Lancar", nilai: s.neraca.asetLancar },
          { label: "Aset Tidak Lancar", nilai: s.neraca.asetTetap - s.neraca.penyusutan },
        ]}
        totals={[
          { label: "Total Aset", nilai: s.neraca.totalAset },
          { label: "Liabilitas Jangka Pendek", nilai: s.neraca.liabilitasPendek },
          { label: "Liabilitas Jangka Panjang", nilai: s.neraca.liabilitasPanjang },
          { label: "Modal Pemilik", nilai: s.neraca.modal },
          { label: "Total Liabilitas + Modal", nilai: s.neraca.totalLiabilitasModal },
        ]}
      />

      <SectionCard
        judul="Arus Kas"
        rows={[
          { label: "Kas dari Aktivitas Operasional", nilai: s.arusKas.operasional },
          { label: "Kas dari Aktivitas Investasi", nilai: s.arusKas.investasi },
          { label: "Kas dari Aktivitas Pendanaan", nilai: s.arusKas.pendanaan },
        ]}
        totals={[
          { label: "Kenaikan / Penurunan Kas", nilai: s.arusKas.kenaikan },
          { label: "Saldo Kas Akhir", nilai: s.arusKas.saldoAkhir },
        ]}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700">Wawasan Bisnis</div>
        <Table>
          <TableBody>
            {s.wawasan.map((w) => (
              <TableRow key={w.nama}>
                <TableCell className="text-xs text-slate-600">{w.nama}</TableCell>
                <TableCell className="text-right text-xs tabular-nums text-slate-700">
                  {formatRasio(w.nilai, w.satuan)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <BarisNilai label="Keuntungan Bersih / (Rugi)" value={s.labaRugi.labaBersih} strong />

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

export function RingkasanBisnisContent() {
  const [applied, setApplied] = useState<{ periode: RingkasanBisnisPeriode; dari: string; sampai: string }>({
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
    fetch(`/api/keuangan/laporan/ringkasan-bisnis?${queryDaftar()}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as ApiData);
          setPilihan(null);
        } else {
          setError(j?.message || "Gagal memuat daftar Ringkasan Bisnis");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat daftar Ringkasan Bisnis");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryDaftar]);

  // Filter langsung teraplikasi setiap ada perubahan (tanpa tombol Filter).
  const gantiPeriode = (v: RingkasanBisnisPeriode) => {
    setFilterError("");
    setApplied((a) => ({ ...a, periode: v }));
  };

  const gantiTanggal = (key: "dari" | "sampai", value: string) => {
    const next = { ...applied, [key]: value };
    if (next.dari && next.sampai && new Date(next.sampai) < new Date(next.dari)) {
      setFilterError("Tanggal akhir tidak boleh lebih awal dari tanggal awal");
      return;
    }
    setFilterError("");
    setApplied(next);
  };

  const daftar: RingkasanBisnisSnapshot[] =
    data?.mode === "monthly"
      ? data.snapshots
      : data?.mode === "single"
        ? [data.snapshot]
        : [];
  const aktif = pilihan !== null ? (daftar[pilihan] ?? null) : null;

  // Query unduhan SELALU menunjuk ke periode dokumen yang sedang dibuka.
  const queryDokumen = useCallback(
    (s: RingkasanBisnisSnapshot) => {
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

  const download = async (s: RingkasanBisnisSnapshot, fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuUnduh(false);
    try {
      const res = await fetch(`/api/keuangan/laporan/ringkasan-bisnis?${queryDokumen(s)}&format=${fmt}`, {
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
      a.download = m?.[1] ?? `ringkasan-bisnis.${fmt}`;
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
          Detail, PDF, dan XLSX memakai sumber data Ringkasan Bisnis yang sama sehingga angkanya identik.
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
              <label htmlFor="ringkasan-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
                Filter sesuai periode
              </label>
              <Select
                id="ringkasan-periode"
                value={applied.periode}
                onChange={(e) => gantiPeriode(e.target.value as RingkasanBisnisPeriode)}
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
                  <label htmlFor="ringkasan-dari" className="mb-1.5 block text-xs font-medium text-slate-600">
                    Tanggal awal
                  </label>
                  <Input id="ringkasan-dari" type="date" value={applied.dari} onChange={(e) => gantiTanggal("dari", e.target.value)} className="h-10 text-sm" />
                </div>
                <span className="pb-3 text-slate-400">–</span>
                <div>
                  <label htmlFor="ringkasan-sampai" className="mb-1.5 block text-xs font-medium text-slate-600">
                    Tanggal akhir
                  </label>
                  <Input id="ringkasan-sampai" type="date" value={applied.sampai} onChange={(e) => gantiTanggal("sampai", e.target.value)} className="h-10 text-sm" />
                </div>
              </div>
            )}
          </div>
          {filterError && <p className="text-xs text-red-600">{filterError}</p>}
        </CardContent>
      </Card>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Memuat daftar Ringkasan Bisnis...</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : daftar.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Tidak ada dokumen Ringkasan Bisnis pada periode ini.</p>
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
