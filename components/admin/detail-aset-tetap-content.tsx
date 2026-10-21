"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  RINGKASAN_ASET_PERIODE_LABEL,
  awalUntukRingkasanAset,
  akhirUntukRingkasanAset,
  toYMDPendek,
  type RingkasanAsetPeriode,
  type DetailAsetSnapshot,
  type DetailAsetGrup,
} from "@/lib/ringkasan-aset-detail-types";

type Draft = {
  periode: RingkasanAsetPeriode;
  tanggalAwal: string;
  tanggalAkhir: string;
};

const PERIODE_OPTIONS = (
  Object.keys(RINGKASAN_ASET_PERIODE_LABEL) as RingkasanAsetPeriode[]
).map((v) => ({ value: v, label: RINGKASAN_ASET_PERIODE_LABEL[v] }));

function presetDates(periode: RingkasanAsetPeriode) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let awal = awalUntukRingkasanAset(periode, now);
  let akhir = akhirUntukRingkasanAset(periode, now);
  if (awal > today) awal = today;
  if (akhir > today) akhir = today;
  return { tanggalAwal: toYMDPendek(awal), tanggalAkhir: toYMDPendek(akhir) };
}

function initialDraft(): Draft {
  const periode: RingkasanAsetPeriode = "bulan-ini";
  return { periode, ...presetDates(periode) };
}

function formatTanggal(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DetailAsetTetapContent() {
  const [draft, setDraft] = useState<Draft>(() => initialDraft());
  const [applied, setApplied] = useState<Draft>(() => initialDraft());
  const [data, setData] = useState<DetailAsetSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [menuEkspor, setMenuEkspor] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const queryFor = useCallback((f: Draft) => {
    return new URLSearchParams({
      periode: f.periode,
      tanggalAwal: f.tanggalAwal,
      tanggalAkhir: f.tanggalAkhir,
    }).toString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/keuangan/laporan/detail-aset-tetap?${queryFor(applied)}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as DetailAsetSnapshot);
          // Buka semua grup secara default
          setOpenGroups(new Set((j.data as DetailAsetSnapshot).grup.map((g: DetailAsetGrup) => g.kode)));
        } else {
          setError(j?.message || "Gagal memuat laporan Detail Aset Tetap");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat laporan Detail Aset Tetap");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, queryFor]);

  const gantiPeriode = (v: RingkasanAsetPeriode) => {
    setFilterError("");
    if (v === "custom") {
      setDraft((d) => ({ ...d, periode: v }));
      return;
    }
    setDraft({ periode: v, ...presetDates(v) });
  };

  const terapkanFilter = () => {
    if (!draft.tanggalAwal || !draft.tanggalAkhir) {
      setFilterError("Isi tanggal awal dan akhir terlebih dahulu");
      return;
    }
    if (draft.tanggalAwal > draft.tanggalAkhir) {
      setFilterError("Tanggal awal tidak boleh lebih besar dari tanggal akhir");
      return;
    }
    setFilterError("");
    setError("");
    setLoading(true);
    setApplied(draft);
  };

  const toggleGroup = (kode: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(kode)) next.delete(kode);
      else next.add(kode);
      return next;
    });
  };

  const download = async (fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuEkspor(false);
    try {
      const res = await fetch(
        `/api/keuangan/laporan/detail-aset-tetap?${queryFor(applied)}&format=${fmt}`,
        { credentials: "include" }
      );
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
      a.download = m?.[1] ?? `detail-aset-tetap.${fmt}`;
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

  const totalAset = data?.totalAset ?? 0;
  const totalDebit = data?.totalDebit ?? 0;
  const totalKredit = data?.totalKredit ?? 0;
  const totalSaldo = data?.totalSaldoAkhir ?? 0;

  return (
    <div className="space-y-5">
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-sm">Filter Laporan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label
                htmlFor="dat-tanggal-awal"
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Tanggal awal
              </label>
              <Input
                id="dat-tanggal-awal"
                type="date"
                value={draft.tanggalAwal}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, tanggalAwal: e.target.value, periode: "custom" }));
                  setFilterError("");
                }}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="dat-tanggal-akhir"
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Tanggal akhir
              </label>
              <Input
                id="dat-tanggal-akhir"
                type="date"
                value={draft.tanggalAkhir}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, tanggalAkhir: e.target.value, periode: "custom" }));
                  setFilterError("");
                }}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="dat-periode"
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Periode
              </label>
              <Select
                id="dat-periode"
                value={draft.periode}
                onChange={(e) => gantiPeriode(e.target.value as RingkasanAsetPeriode)}
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
                  onClick={() => setMenuEkspor((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuEkspor}
                  className="cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Ekspor
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {menuEkspor && (
                  <>
                    <button
                      type="button"
                      aria-label="Tutup menu ekspor"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setMenuEkspor(false)}
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

      <Card className="border-slate-200">
        <CardContent className="p-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-1 border-b border-slate-100 pb-4 text-center">
              <p className="text-sm font-semibold tracking-tight text-slate-900">
                PT BUMI SURYA FARM
              </p>
              <p className="text-sm font-semibold text-slate-900">Detail Aset Tetap</p>
              <p className="text-xs text-slate-500">{data?.label ?? "—"}</p>
              <p className="text-xs text-slate-400">
                (dalam Rupiah)
                {data ? ` · ${totalAset} aset` : ""}
              </p>
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-400">Memuat laporan...</p>
            ) : !data || totalAset === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">Belum ada transaksi aset tetap</p>
                <p className="mt-1 text-xs text-slate-500">
                  Tidak ada transaksi aset tetap yang memenuhi kriteria pada rentang periode ini.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="min-w-[60px] whitespace-nowrap text-xs text-center">
                        Tanggal
                      </TableHead>
                      <TableHead className="min-w-[50px] whitespace-nowrap text-xs text-center">
                        Tindakan
                      </TableHead>
                      <TableHead className="min-w-[90px] whitespace-nowrap text-xs">
                        Transaksi
                      </TableHead>
                      <TableHead className="min-w-[50px] whitespace-nowrap text-xs text-center">
                        Nomor
                      </TableHead>
                      <TableHead className="min-w-[55px] whitespace-nowrap text-xs text-center">
                        Nomor Akun
                      </TableHead>
                      <TableHead className="min-w-[140px] whitespace-nowrap text-xs">
                        Nama Akun
                      </TableHead>
                      <TableHead className="min-w-[90px] whitespace-nowrap text-right text-xs">
                        Debit
                      </TableHead>
                      <TableHead className="min-w-[90px] whitespace-nowrap text-right text-xs">
                        Kredit
                      </TableHead>
                      <TableHead className="min-w-[100px] whitespace-nowrap text-right text-xs">
                        Nilai Buku
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.grup.map((g) => {
                      const isOpen = openGroups.has(g.kode);
                      return (
                        <React.Fragment key={`grp-${g.kode}`}>
                          <TableRow
                            key={`grp-row-${g.kode}`}
                            onClick={() => toggleGroup(g.kode)}
                            className="cursor-pointer bg-slate-100/80 hover:bg-slate-200 transition-colors"
                          >
                            <TableCell colSpan={9} className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                              <span className={`shrink-0 ${isOpen ? "rotate-90" : ""}`}>
                                <ChevronRight className="h-3 w-3" />
                              </span>
                              {g.kode} - {g.nama}
                              <span className="ml-auto text-xs text-slate-500 font-normal">
                                {g.kategori}
                              </span>
                            </TableCell>
                          </TableRow>
                          {isOpen && g.baris.map((b, bi) => (
                            <TableRow
                              key={`baris-${g.kode}-${bi}`}
                              className={b.isInformational ? "text-slate-500" : ""}
                            >
                              <TableCell className="whitespace-nowrap text-xs text-slate-600 pl-8">
                                {formatTanggal(b.tanggal)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-slate-600 pl-8">
                                {b.tindakan === "AKUISISI" ? "Akuisisi" : b.tindakan === "PENYUSUTAN" ? "Penyusutan" : "Pelepasan"}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate whitespace-nowrap text-xs pl-8" title={b.transaksi}>
                                {b.transaksi}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-slate-600 pl-8">
                                {b.nomor}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-slate-600 pl-8">
                                {b.nomorAkun}
                              </TableCell>
                              <TableCell className="max-w-[120px] truncate whitespace-nowrap text-xs pl-8" title={b.namaAkun}>
                                {b.namaAkun}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right text-xs tabular-nums pl-8">
                                {b.debit > 0 ? formatRupiah(b.debit) : "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right text-xs tabular-nums pl-8">
                                {b.kredit > 0 ? formatRupiah(b.kredit) : "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right text-xs tabular-nums font-medium pl-8">
                                {formatRupiah(b.nilaiBuku)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-slate-50/70">
                            <TableCell colSpan={6} className="text-xs font-semibold text-slate-600 pl-8">
                              Subtotal {g.kode}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-700">
                              {formatRupiah(g.subtotalDebit)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-700">
                              {formatRupiah(g.subtotalKredit)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900">
                              {formatRupiah(g.saldoAkhir)}
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                    <TableRow className="bg-emerald-700">
                      <TableCell colSpan={6} className="text-xs font-semibold text-white pl-8">
                        TOTAL ({totalAset} aset)
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {formatRupiah(totalDebit)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {formatRupiah(totalKredit)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {formatRupiah(totalSaldo)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {data && data.catatan.length > 0 && (
              <ul className="space-y-1 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">
                {data.catatan.map((c) => (
                  <li key={c} className="flex gap-1.5">
                    <span className="text-slate-400">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-400">
        <Download className="h-3.5 w-3.5 shrink-0" />
        Baris dengan warna abu-abu adalah catatan informatif (penyusutan / pelepasan) yang bukan jurnal aktual dari database.
      </p>
    </div>
  );
}
