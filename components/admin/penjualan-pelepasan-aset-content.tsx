"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  RINGKASAN_ASET_PERIODE_LABEL,
  awalUntukRingkasanAset,
  akhirUntukRingkasanAset,
  toYMDPendek,
  type RingkasanAsetPeriode,
  type PenjualanPelepasanSnapshot,
} from "@/lib/penjualan-pelepasan-aset-types";

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

export function PenjualanPelepasanAsetContent() {
  const [draft, setDraft] = useState<Draft>(() => initialDraft());
  const [applied, setApplied] = useState<Draft>(() => initialDraft());
  const [data, setData] = useState<PenjualanPelepasanSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [menuEkspor, setMenuEkspor] = useState(false);
  const [dl, setDl] = useState<"pdf" | "xlsx" | null>(null);

  const queryFor = useCallback((f: Draft) => {
    return new URLSearchParams({
      periode: f.periode,
      tanggalAwal: f.tanggalAwal,
      tanggalAkhir: f.tanggalAkhir,
    }).toString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/keuangan/laporan/penjualan-pelepasan-aset?${queryFor(applied)}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) {
          setData(j.data as PenjualanPelepasanSnapshot);
        } else {
          setError(j?.message || "Gagal memuat laporan Penjualan/Pelepasan Aset");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat laporan Penjualan/Pelepasan Aset");
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

  const download = async (fmt: "pdf" | "xlsx") => {
    setDl(fmt);
    setMenuEkspor(false);
    try {
      const res = await fetch(
        `/api/keuangan/laporan/penjualan-pelepasan-aset?${queryFor(applied)}&format=${fmt}`,
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
      a.download = m?.[1] ?? `penjualan-pelepasan-aset.${fmt}`;
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
  const totalBiayaAwal = data?.totalBiayaAwal ?? 0;
  const totalAkumulasi = data?.totalAkumulasiPenyusutan ?? 0;
  const totalNilaiBuku = data?.totalNilaiBuku ?? 0;
  const totalHargaJual = data?.totalHargaJual ?? 0;
  const totalUntungRugi = data?.totalUntungRugi ?? 0;

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
                htmlFor="ppa-tanggal-awal"
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Tanggal awal
              </label>
              <Input
                id="ppa-tanggal-awal"
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
                htmlFor="ppa-tanggal-akhir"
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Tanggal akhir
              </label>
              <Input
                id="ppa-tanggal-akhir"
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
                htmlFor="ppa-periode"
                className="mb-1.5 block text-xs font-medium text-slate-600"
              >
                Periode
              </label>
              <Select
                id="ppa-periode"
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
              <p className="text-sm font-semibold text-slate-900">
                Penjualan / Pelepasan Aset
              </p>
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
                <p className="text-sm font-semibold text-slate-900">
                  Belum ada penjualan atau pelepasan aset
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Tidak ada aset yang dijual atau dilepas pada rentang periode ini.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table className="min-w-[1300px]">
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="min-w-[90px] whitespace-nowrap text-xs">
                        Aset
                      </TableHead>
                      <TableHead className="min-w-[70px] whitespace-nowrap text-xs text-center">
                        Tgl Akuisisi
                      </TableHead>
                      <TableHead className="min-w-[70px] whitespace-nowrap text-xs text-center">
                        Tgl Pelepasan
                      </TableHead>
                      <TableHead className="min-w-[85px] whitespace-nowrap text-right text-xs">
                        Biaya Awal
                      </TableHead>
                      <TableHead className="min-w-[85px] whitespace-nowrap text-right text-xs">
                        Akumulasi
                      </TableHead>
                      <TableHead className="min-w-[85px] whitespace-nowrap text-right text-xs">
                        Nilai Buku
                      </TableHead>
                      <TableHead className="min-w-[85px] whitespace-nowrap text-right text-xs">
                        Harga Jual
                      </TableHead>
                      <TableHead className="min-w-[85px] whitespace-nowrap text-right text-xs">
                        Untung/Rugi
                      </TableHead>
                      <TableHead className="min-w-[95px] whitespace-nowrap text-xs">
                        Status
                      </TableHead>
                      <TableHead className="min-w-[110px] whitespace-nowrap text-xs">
                        Akun Penerima/Piutang
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.kelompok.map((g) => (
                      <FragmentGroup key={g.kode} grup={g} />
                    ))}
                    <TableRow className="bg-emerald-700">
                      <TableCell colSpan={3} className="text-xs font-semibold text-white">
                        TOTAL ({totalAset} aset)
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {formatRupiah(totalBiayaAwal)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {formatRupiah(totalAkumulasi)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {formatRupiah(totalNilaiBuku)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white">
                        {formatRupiah(totalHargaJual)}
                      </TableCell>
                      <TableCell className={`whitespace-nowrap text-right text-xs font-semibold tabular-nums text-white ${totalUntungRugi >= 0 ? "text-green-300" : "text-red-300"}`}>
                        {totalUntungRugi >= 0 ? `+${formatRupiah(totalUntungRugi)}` : `−${formatRupiah(Math.abs(totalUntungRugi))}`}
                      </TableCell>
                      <TableCell colSpan={2} className="whitespace-nowrap text-right text-xs font-semibold text-white">
                        —
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
        Tabel, PDF, dan XLSX memakai sumber data laporan yang sama sehingga angkanya identik.
      </p>
    </div>
  );
}

function FragmentGroup({
  grup,
}: {
  grup: PenjualanPelepasanSnapshot["kelompok"][number];
}) {
  const label =
    grup.kode === "(tanpa akun)" ? "Tanpa akun aset" : `${grup.kode} - ${grup.nama}`;

  return (
    <>
      <TableRow className="bg-slate-100/80">
        <TableCell colSpan={10} className="text-xs font-semibold text-slate-700">
          {label}
        </TableCell>
      </TableRow>
      {grup.baris.map((b) => {
        const isUntungPositif = b.untungRugi >= 0;
        return (
          <TableRow key={b.nomorAset}>
            <TableCell className="whitespace-nowrap text-xs font-medium text-slate-900 pl-2">
              {b.nomorAset}
            </TableCell>
            <TableCell
              className="max-w-[150px] truncate whitespace-nowrap text-xs pl-2"
              title={b.namaAset}
            >
              {b.namaAset}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-slate-600 pl-2">
              {formatTanggal(b.tanggalAkuisisi)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-slate-600 pl-2">
              {formatTanggal(b.tanggalPelepasan)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700 pl-2">
              {formatRupiah(b.biayaAwal)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700 pl-2">
              {formatRupiah(b.akumulasiPenyusutan)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-900 pl-2 font-medium">
              {formatRupiah(b.nilaiBuku)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-slate-700 pl-2">
              {formatRupiah(b.hargaJual)}
            </TableCell>
            <TableCell className={`whitespace-nowrap text-right text-xs tabular-nums pl-2 ${isUntungPositif ? "text-green-700" : "text-red-700"} font-medium`}>
              {b.untungRugi >= 0 ? `+${formatRupiah(b.untungRugi)}` : `−${formatRupiah(Math.abs(b.untungRugi))}`}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-slate-600 pl-2">
              {b.statusLabel}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-slate-600 pl-2">
              {b.akunPenerima === "-" ? "—" : `${b.akunPenerima} - ${b.akunPenerimaNama}`}
            </TableCell>
          </TableRow>
        );
      })}
      <TableRow className="bg-slate-50/70">
        <TableCell colSpan={3} className="text-xs font-semibold text-slate-600 pl-2">
          Subtotal {grup.kode === "(tanpa akun)" ? "tanpa akun" : grup.kode}
        </TableCell>
        <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-700 pl-2">
          {formatRupiah(grup.subtotalBiayaAwal)}
        </TableCell>
        <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-700 pl-2">
          {formatRupiah(grup.subtotalAkumulasiPenyusutan)}
        </TableCell>
        <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900 pl-2 font-medium">
          {formatRupiah(grup.subtotalNilaiBuku)}
        </TableCell>
        <TableCell className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-700 pl-2">
          {formatRupiah(grup.subtotalHargaJual)}
        </TableCell>
        <TableCell className={`whitespace-nowrap text-right text-xs font-semibold tabular-nums pl-2 ${grup.subtotalUntungRugi >= 0 ? "text-green-700" : "text-red-700"}`}>
          {grup.subtotalUntungRugi >= 0 ? `+${formatRupiah(grup.subtotalUntungRugi)}` : `−${formatRupiah(Math.abs(grup.subtotalUntungRugi))}`}
        </TableCell>
        <TableCell colSpan={2} className="whitespace-nowrap text-xs text-slate-600 pl-2">
          —
        </TableCell>
      </TableRow>
    </>
  );
}
