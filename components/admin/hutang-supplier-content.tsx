"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  HUTANG_SUPPLIER_PERIODE_LABEL,
  type HutangSupplierPeriode,
  type HutangSupplierSnapshot,
} from "@/lib/hutang-supplier-types";

// Tampilan tunggal ala Daftar Pembelian: kartu filter di atas, tabel laporan
// langsung di bawahnya (tanpa daftar dokumen / tombol "Lihat Laporan").
// Tampilan DETAIL memuat kartu filter yang sama persis seperti Daftar
// Penjualan (tanggal awal, tanggal akhir, periode, Filter, Ekspor).
// Laporan POSISI per tanggal akhir: seluruh hutang yang belum lunas s/d
// tanggal akhir ikut tampil (termasuk faktur lama) — pola Piutang Pelanggan.

type Draft = { periode: HutangSupplierPeriode; dari: string; sampai: string };

const PERIODE_OPTIONS = (Object.keys(HUTANG_SUPPLIER_PERIODE_LABEL) as HutangSupplierPeriode[]).map((v) => ({
  value: v,
  label: HUTANG_SUPPLIER_PERIODE_LABEL[v],
}));

const LIMIT = 10;

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

/** Cerminan preset periode server — mengisi otomatis tanggal awal/akhir. */
function rentangUntuk(periode: HutangSupplierPeriode): { dari: string; sampai: string } | null {
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
function fmtTgl(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Kartu filter yang sama persis seperti Daftar Penjualan: tanggal awal,
// tanggal akhir, periode, tombol Filter, dan tombol Ekspor (PDF/XLSX).
// Dipakai di tampilan daftar maupun detail.
function KartuFilter({
  draft,
  filterError,
  menuUnduh,
  dl,
  onDari,
  onSampai,
  onPeriode,
  onTerapkan,
  onToggleUnduh,
  onTutupUnduh,
  onDownload,
}: {
  draft: Draft;
  filterError: string;
  menuUnduh: boolean;
  dl: "pdf" | "xlsx" | null;
  onDari: (v: string) => void;
  onSampai: (v: string) => void;
  onPeriode: (v: HutangSupplierPeriode) => void;
  onTerapkan: () => void;
  onToggleUnduh: () => void;
  onTutupUnduh: () => void;
  onDownload: (fmt: "pdf" | "xlsx") => void;
}) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="text-sm">Filter Laporan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label htmlFor="hs-dari" className="mb-1.5 block text-xs font-medium text-slate-600">
              Tanggal awal
            </label>
            <Input
              id="hs-dari"
              type="date"
              value={draft.dari}
              onChange={(e) => onDari(e.target.value)}
              className="h-10 text-sm"
            />
          </div>
          <div>
            <label htmlFor="hs-sampai" className="mb-1.5 block text-xs font-medium text-slate-600">
              Tanggal akhir
            </label>
            <Input
              id="hs-sampai"
              type="date"
              value={draft.sampai}
              onChange={(e) => onSampai(e.target.value)}
              className="h-10 text-sm"
            />
          </div>
          <div>
            <label htmlFor="hs-periode" className="mb-1.5 block text-xs font-medium text-slate-600">
              Periode
            </label>
            <Select
              id="hs-periode"
              value={draft.periode}
              onChange={(e) => onPeriode(e.target.value as HutangSupplierPeriode)}
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
              onClick={onTerapkan}
              className="w-full cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
            >
              Filter
            </Button>
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                onClick={onToggleUnduh}
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
                    aria-label="Tutup menu ekspor"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={onTutupUnduh}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      disabled={dl !== null}
                      onClick={() => onDownload("pdf")}
                      className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <FileText className="h-4 w-4 text-slate-400" />
                      {dl === "pdf" ? "Menyiapkan PDF..." : "Download PDF"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={dl !== null}
                      onClick={() => onDownload("xlsx")}
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
  );
}

export function HutangSupplierContent() {
  const [draft, setDraft] = useState<Draft>({ periode: "hari-ini", dari: todayYMD(), sampai: todayYMD() });
  const [applied, setApplied] = useState<Draft>({ periode: "hari-ini", dari: todayYMD(), sampai: todayYMD() });
  const [data, setData] = useState<HutangSupplierSnapshot | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [menuUnduh, setMenuUnduh] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  // Posisi dihitung per tanggal akhir (sampai) agar faktur lama yang belum
  // lunas tetap tampil; tanggal awal (dari) dipakai untuk baris saldo awal
  // + riwayat mutasi faktur/pembayaran per supplier.
  const queryFor = useCallback((f: Draft, p: number) => {
    const q = new URLSearchParams({
      periode: f.periode,
      tanggal: f.sampai,
      dari: f.dari,
      page: String(p),
      limit: String(LIMIT),
    });
    return q.toString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/keuangan/laporan/hutang-supplier?${queryFor(applied, page)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as HutangSupplierSnapshot);
          const pg = j.data?.pagination;
          if (pg) setTotalPages(Math.max(1, pg.totalPages ?? 1));
        } else {
          setError(j?.message || "Gagal memuat Hutang Supplier");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat Hutang Supplier");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, page, queryFor]);

  // Memilih periode otomatis mengisi tanggal awal/akhir; tanggal yang
  // diketik manual otomatis menjadi periode "custom" agar benar-benar terpakai.
  const gantiPeriode = (v: HutangSupplierPeriode) => {
    setFilterError("");
    const r = rentangUntuk(v);
    setDraft((d) => (r ? { periode: v, dari: r.dari, sampai: r.sampai } : { ...d, periode: v }));
  };

  const gantiTanggal = (key: "dari" | "sampai", value: string) => {
    setFilterError("");
    setDraft((d) => ({ ...d, [key]: value, periode: "custom" as HutangSupplierPeriode }));
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
    setPage(1);
    setApplied(draft);
  };

  const download = async (fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuUnduh(false);
    try {
      // Unduhan selalu memuat SELURUH data terfilter (tanpa paginasi).
      const q = new URLSearchParams({
        periode: applied.periode,
        tanggal: applied.sampai,
        dari: applied.dari,
        format: fmt,
      });
      const res = await fetch(`/api/keuangan/laporan/hutang-supplier?${q.toString()}`, {
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
      a.download = m?.[1] ?? `hutang-supplier.${fmt}`;
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

  const grup = data?.grup ?? [];
  const total = data?.totalGrup ?? 0;
  const asOfYmd = data?.tanggal.slice(0, 10) ?? "";
  const lewatJatuhTempo = (jt: string | null) => !!jt && jt.slice(0, 10) < asOfYmd;
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to = Math.min(page * LIMIT, total);
  const halaman = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1
  );

  // Tampilan tunggal ala Daftar Pembelian: filter di atas, tabel laporan
  // langsung di bawahnya (tanpa daftar dokumen / tombol "Lihat Laporan").
  return (
    <div className="space-y-5">
      <KartuFilter
          draft={draft}
          filterError={filterError}
          menuUnduh={menuUnduh}
          dl={dl}
          onDari={(v) => gantiTanggal("dari", v)}
          onSampai={(v) => gantiTanggal("sampai", v)}
          onPeriode={gantiPeriode}
          onTerapkan={terapkanFilter}
          onToggleUnduh={() => setMenuUnduh((v) => !v)}
          onTutupUnduh={() => setMenuUnduh(false)}
          onDownload={download}
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        <Card className="border-slate-200">
          <CardContent className="p-5 sm:p-6">
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
                <p className="text-sm font-semibold tracking-tight text-slate-900">PT BUMI SURYA FARM</p>
                <p className="text-sm font-semibold text-slate-900">Laporan Hutang Supplier</p>
                <p className="text-xs text-slate-500">{data?.label ?? "—"}</p>
                <p className="text-xs text-slate-400">(dalam IDR)</p>
              </div>

              {loading ? (
                <p className="py-10 text-center text-sm text-slate-400">Memuat laporan...</p>
              ) : grup.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold text-slate-900">Tidak ada transaksi pada periode ini</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Silakan pilih tanggal atau periode lain, lalu klik tombol Filter.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Supplier / Tanggal</TableHead>
                        <TableHead className="text-xs">Transaksi</TableHead>
                        <TableHead className="text-xs">No.</TableHead>
                        <TableHead className="text-xs">Jatuh Tempo</TableHead>
                        <TableHead className="text-xs">Keterangan</TableHead>
                        <TableHead className="text-right text-xs">Jumlah</TableHead>
                        <TableHead className="text-right text-xs">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grup.map((g) => (
                        <Fragment key={g.supplier}>
                          <TableRow key={`h-${g.supplier}`} className="bg-slate-50/70">
                            <TableCell colSpan={7} className="text-xs font-semibold uppercase text-slate-900">
                              {g.supplier}
                            </TableCell>
                          </TableRow>
                          {g.baris.map((b) => (
                            <TableRow key={b.id} className={b.jenis === "saldo-awal" ? "bg-slate-50/40" : undefined}>
                              <TableCell className="whitespace-nowrap text-xs text-slate-500">
                                {fmtTgl(b.tanggal)}
                              </TableCell>
                              <TableCell
                                className={`whitespace-nowrap text-xs ${
                                  b.jenis === "saldo-awal" ? "font-medium text-slate-700" : "text-slate-600"
                                }`}
                              >
                                {b.transaksi}
                              </TableCell>
                              <TableCell className="whitespace-nowrap font-mono text-[11px] text-slate-600">
                                {b.no}
                              </TableCell>
                              <TableCell
                                className={`whitespace-nowrap text-xs tabular-nums ${
                                  lewatJatuhTempo(b.jatuhTempo)
                                    ? "font-semibold text-red-600"
                                    : "text-slate-500"
                                }`}
                                title={lewatJatuhTempo(b.jatuhTempo) ? "Lewat jatuh tempo" : undefined}
                              >
                                {b.jatuhTempo ? fmtTgl(b.jatuhTempo) : "—"}
                              </TableCell>
                              <TableCell className="max-w-56 truncate text-xs text-slate-600">
                                {b.keterangan}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                                {b.jenis === "saldo-awal" ? "—" : rp(b.jumlah)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700">
                                {rp(b.saldo)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow key={`t-${g.supplier}`} className="bg-slate-50/50">
                            <TableCell colSpan={5} className="text-xs font-semibold text-slate-900">
                              TOTAL {g.supplier.toUpperCase()}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                              {rp(g.totalJumlah)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                              {rp(g.totalSaldo)}
                            </TableCell>
                          </TableRow>
                        </Fragment>
                      ))}
                      <TableRow className="bg-emerald-700">
                        <TableCell colSpan={5} className="text-xs font-semibold text-white">
                          GRAND TOTAL
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                          {rp(data?.grandJumlah ?? 0)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                          {rp(data?.grandSaldo ?? 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}

              {!loading && grup.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-slate-400">
                    Menampilkan {from}-{to} dari {total} supplier
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
                    </Button>
                    {halaman.map((n, i, arr) => (
                      <span key={n} className="flex items-center gap-1">
                        {i > 0 && n - arr[i - 1] > 1 && <span className="text-xs text-slate-300">…</span>}
                        <Button
                          variant={n === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(n)}
                          className={`h-8 w-8 p-0 cursor-pointer ${n === page ? "bg-emerald-700 hover:bg-emerald-800" : ""}`}
                        >
                          {n}
                        </Button>
                      </span>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="cursor-pointer"
                    >
                      Berikutnya <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-400">
          <Download className="h-3.5 w-3.5 shrink-0" />
          Tabel, PDF, dan XLSX memakai sumber data Hutang Supplier yang sama sehingga angkanya identik.
        </p>
    </div>
  );
}
