"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeftRight,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  PackageSearch,
  Pencil,
  Plus,
  ScrollText,
  Search,
  ShoppingCart,
  Tags,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { cn, formatRupiah } from "@/lib/utils";

export type PenagihanRow = {
  kind: "tagihan" | "dokumen";
  id: string;
  docId: string | null;
  tanggal: string;
  noInvoice: string | null;
  jenis: string | null;
  dokumen: string | null;
  pihak: string;
  keterangan: string | null;
  jatuhTempo: string | null;
  status: "BELUM_LUNAS" | "LUNAS_SEBAGIAN" | "LUNAS";
  docStatus: string | null;
  sisa: number | null;
  jumlah: number;
};

export type DokumenRow = {
  id: string;
  tipe: string;
  noDokumen: string;
  pelanggan: string;
  tanggal: string;
  jatuhTempo: string | null;
  status: string;
  total: number;
};

export type PengirimanRow = {
  id: string;
  noPengiriman: string;
  pesananId: string;
  pesananNo: string;
  pelanggan: string;
  tanggal: string;
  jumlahItem: number;
  status: string;
};

const SLUG_BY_TIPE: Record<string, string> = {
  PENAGIHAN: "penagihan",
  PROFORMA: "proforma",
  TUKAR_FAKTUR: "tukar-faktur",
  PESANAN: "pesanan",
  PENAWARAN: "penawaran",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  TERBUKA: "Terbuka",
  DITUTUP: "Ditutup",
  BELUM_DITAGIH: "Belum Ditagih",
  SELESAI: "Selesai",
  PESANAN: "Pesanan",
  PESANAN_PROFORMA: "Pesanan Proforma",
};

const DOC_STATUS_VARIANT: Record<string, StatusBadge["variant"]> = {
  TERBUKA: "warning",
  DITUTUP: "secondary",
  BELUM_DITAGIH: "gray",
  SELESAI: "sehat",
  PESANAN: "info",
  PESANAN_PROFORMA: "perhatian",
};

export type PenjualanSummary = {
  belumDibayar: number;
  belumDibayarCount: number;
  telatDibayar: number;
  telatDibayarCount: number;
  pelunasan30Hari: number;
  pelunasan30Count: number;
};

type TabKey = "penagihan" | "pengiriman" | "pesanan" | "penawaran";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "penagihan", label: "Penagihan" },
  { key: "pengiriman", label: "Pengiriman" },
  { key: "pesanan", label: "Pesanan" },
  { key: "penawaran", label: "Penawaran" },
];

// Menu "Buat Penjualan Baru" — navigasi ke halaman masing-masing (form dibuat terpisah).
const BUAT_ITEMS = [
  { href: "/keuangan/penjualan/penagihan/baru", label: "Penagihan Penjualan", desc: "Invoice tagihan ke pelanggan", Icon: ScrollText },
  { href: "/keuangan/penjualan/tukar-faktur/baru", label: "Tukar Faktur", desc: "Penagihan atas faktur berjalan", Icon: ArrowLeftRight },
  { href: "/keuangan/penjualan/pesanan/baru", label: "Pesanan Penjualan", desc: "Sales order dari pelanggan", Icon: ShoppingCart },
  { href: "/keuangan/penjualan/penawaran/baru", label: "Penawaran Penjualan", desc: "Quotation harga ke pelanggan", Icon: Tags },
];

const JENIS_LABEL: Record<string, string> = {
  HASIL_KEBUN: "Hasil Kebun",
  TERNAK: "Ternak",
  IKAN: "Ikan",
  LAINNYA: "Lainnya",
};

type StatusBadge = { label: string; variant: "sehat" | "perhatian" | "outline" | "destructive" | "secondary" | "warning" | "info" | "gray" };

// Badge kolom Status memakai kosakata yang sama dengan filter, diturunkan dari kondisi nyata:
// status bayar + jatuh tempo vs hari ini. Satu baris = satu badge (prioritas: Dibayar > Telat > Sebagian > Menunggu).
// Baris dokumen non-piutang menampilkan status dokumennya sendiri.
function displayStatus(r: PenagihanRow): StatusBadge {
  if (r.kind === "dokumen") {
    const ds = r.docStatus ?? "";
    const label = DOC_STATUS_LABEL[ds] ?? ds ?? "—";
    return { label, variant: DOC_STATUS_VARIANT[ds] ?? "secondary" };
  }
  if (r.status === "LUNAS") return { label: "Dibayar", variant: "sehat" };
  if (isTelat(r)) return { label: "Telat Bayar", variant: "destructive" };
  if (r.status === "LUNAS_SEBAGIAN") return { label: "Dibayar Sebagian", variant: "info" };
  return { label: "Menunggu Pembayaran", variant: "warning" };
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// No. Invoice dari database; baris lama (null) tampil sebagai referensi ID singkat.
function displayInvoice(row: PenagihanRow) {
  if (row.noInvoice) return row.noInvoice;
  return `…${row.id.slice(-6).toUpperCase()}`;
}

function isTelat(row: PenagihanRow) {
  if (row.status === "LUNAS" || !row.jatuhTempo) return false;
  const tempo = new Date(row.jatuhTempo);
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  return tempo < hariIni;
}

function BuatPenjualanDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <Plus className="h-4 w-4" /> Buat Penjualan Baru
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {BUAT_ITEMS.map(({ href, label, desc, Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-900">{label}</span>
                <span className="block text-xs text-slate-500">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  tone,
  Icon,
}: {
  label: string;
  value: number;
  note: string;
  tone: "amber" | "red" | "green";
  Icon: React.ElementType;
}) {
  const tones = {
    amber: { box: "border-amber-200 bg-amber-50", text: "text-amber-700", icon: "text-amber-600" },
    red: { box: "border-red-200 bg-red-50", text: "text-red-700", icon: "text-red-500" },
    green: { box: "border-green-200 bg-green-50", text: "text-green-700", icon: "text-green-600" },
  }[tone];
  return (
    <Card className={`rounded-2xl border shadow-sm ${tones.box}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500">
          <Icon aria-hidden="true" className={`h-4 w-4 ${tones.icon}`} />
          <span>{label}</span>
        </div>
        <div className={`mt-3 text-2xl font-semibold tracking-tight sm:text-3xl ${tones.text}`}>
          Rp {formatRupiah(value)}
        </div>
        <div className="mt-1.5 text-xs text-slate-400">{note}</div>
      </CardContent>
    </Card>
  );
}

// Tabel dokumen per tab (Pesanan / Penawaran): filter search + status di atas kolom.
// Klik No. membuka popup detail seperti Penagihan (bukan pindah halaman).
function DokumenTable({
  rows,
  tempoLabel,
  noLabel,
  emptyText,
  deletingId,
  onDelete,
  allowedStatuses,
  onOpenDetail,
}: {
  rows: DokumenRow[];
  tempoLabel: string;
  noLabel: string;
  emptyText: string;
  deletingId: string | null;
  onDelete: (id: string, label: string) => void;
  allowedStatuses?: string[];
  onOpenDetail?: (row: DokumenRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const statusOptions = useMemo(() => {
    if (allowedStatuses && allowedStatuses.length > 0) return allowedStatuses;
    return Array.from(new Set(rows.map((r) => r.status)));
  }, [rows, allowedStatuses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (q && !`${r.noDokumen} ${r.id} ${r.pelanggan}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, status, search]);

  return (
    <Card className="border-slate-200">
      <CardContent className="p-0">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-56">
            <option value="">Semua Status</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {DOC_STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </Select>
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. dokumen atau nama pelanggan..."
              className="pl-9 pr-9"
              aria-label="Cari no. dokumen atau nama pelanggan"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                title="Bersihkan pencarian"
                aria-label="Bersihkan pencarian"
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>{noLabel}</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>{tempoLabel}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                    {rows.length === 0 ? emptyText : "Tidak ada data yang cocok dengan filter"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-slate-500">{formatDate(r.tanggal)}</TableCell>
                    <TableCell className="text-xs font-medium" title={r.id}>
                      <button
                        type="button"
                        onClick={() => onOpenDetail?.(r)}
                        className="text-left text-slate-700 underline decoration-dotted hover:text-slate-900"
                        title={r.noDokumen}
                      >
                        {r.noDokumen}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{r.pelanggan}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(r.jatuhTempo)}</TableCell>
                    <TableCell>
                      <Badge variant={DOC_STATUS_VARIANT[r.status] ?? "secondary"} className="text-[11px]">
                        {DOC_STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tracking-tight">
                      Rp {formatRupiah(r.total)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/keuangan/penjualan/${SLUG_BY_TIPE[r.tipe] ?? r.tipe.toLowerCase()}/${r.id}/ubah`}
                          title="Ubah dengan form yang sama"
                          aria-label={`Ubah ${r.noDokumen}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 w-7 rounded-full")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 w-7 rounded-full"
                          title="Hapus dokumen"
                          aria-label={`Hapus ${r.noDokumen}`}
                          disabled={deletingId === r.id}
                          onClick={() => onDelete(r.id, `${r.noDokumen} — ${r.pelanggan}`)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          {filtered.length} dari {rows.length} dokumen
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyTab({ title, desc, action }: { title: string; desc: string; action: string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <PackageSearch className="h-5 w-5" />
        </span>
        <p className="mt-1 text-sm font-medium text-slate-900">{title}</p>
        <p className="max-w-sm text-xs text-slate-500">{desc}</p>
        <Button type="button" variant="outline" size="sm" disabled className="mt-2 cursor-not-allowed opacity-60">
          {action} (Segera hadir)
        </Button>
      </CardContent>
    </Card>
  );
}

// Status turunan dari kondisi nyata: status bayar + jatuh tempo vs hari ini.
// Baris dokumen non-piutang (proforma/tukar faktur) hanya cocok dengan "Semua"
// karena kosakata status pembayaran tidak berlaku untuknya.
function matchStatus(r: PenagihanRow, f: string) {
  if (r.kind === "dokumen") return f === "";
  switch (f) {
    case "LUNAS":
      return r.status === "LUNAS";
    case "LUNAS_SEBAGIAN":
      return r.status === "LUNAS_SEBAGIAN";
    case "BELUM_LUNAS":
      return r.status === "BELUM_LUNAS";
    case "TELAT":
      return isTelat(r);
    case "MENUNGGU":
      return r.status !== "LUNAS" && !isTelat(r);
    default:
      return true;
  }
}

export function PenjualanContent({
  summary,
  rows,
  docs,
  kirim,
  initialTab,
}: {
  summary: PenjualanSummary;
  rows: PenagihanRow[];
  docs: DokumenRow[];
  kirim: PengirimanRow[];
  initialTab: TabKey;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [dokumen, setDokumen] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [kirimStatus, setKirimStatus] = useState("");
  const [kirimSearch, setKirimSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [editRow, setEditRow] = useState<PenagihanRow | null>(null);
  const [editForm, setEditForm] = useState({ pihak: "", noInvoice: "", jenis: "", dokumen: "", jatuhTempo: "", keterangan: "", jumlah: "" });
  const [editLockedJumlah, setEditLockedJumlah] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [detailRow, setDetailRow] = useState<PenagihanRow | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dokDetailRow, setDokDetailRow] = useState<DokumenRow | null>(null);
  const [dokDetailData, setDokDetailData] = useState<any>(null);
  const [dokDetailLoading, setDokDetailLoading] = useState(false);
  const [dokTagihanData, setDokTagihanData] = useState<any>(null);
  const [dokTagihanLoading, setDokTagihanLoading] = useState(false);
  const [kirimDetailRow, setKirimDetailRow] = useState<PengirimanRow | null>(null);
  const [kirimDetailData, setKirimDetailData] = useState<any>(null);
  const [kirimDetailLoading, setKirimDetailLoading] = useState(false);
  const [paymentTargetId, setPaymentTargetId] = useState<string | null>(null);
  const [paymentTargetLabel, setPaymentTargetLabel] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const todayInputLocal = () => new Date(new Date().toDateString()).toISOString().slice(0, 10);
  const [paymentForm, setPaymentForm] = useState({ jumlahBayar: "", sumberDana: "KAS" as "KAS"|"BANK"|"TABUNGAN", tanggal: todayInputLocal(), keterangan: "" });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const toDateInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  const openEdit = async (row: PenagihanRow) => {
    setEditRow(row);
    setEditForm({
      pihak: row.pihak,
      noInvoice: row.noInvoice ?? "",
      jenis: row.jenis ?? "",
      dokumen: row.dokumen ?? "",
      jatuhTempo: toDateInput(row.jatuhTempo),
      keterangan: row.keterangan ?? "",
      jumlah: String(Math.round(row.jumlah)),
    });
    setEditLockedJumlah(false);
    setEditError("");
    try {
      const res = await fetch(`/api/tagihan/${encodeURIComponent(row.id)}`, { credentials: "include" });
      const result = await res.json().catch(() => null);
      if (res.ok && Array.isArray(result?.data?.pembayaran) && result.data.pembayaran.length > 0) {
        setEditLockedJumlah(true);
      }
    } catch {
      // gagal cek riwayat: biarkan server yang memvalidasi saat simpan
    }
  };

  const openDetail = async (row: PenagihanRow) => {
    if (row.kind !== "tagihan") return;
    setDetailRow(row);
    setDetailLoading(true);
    setDetailData(null);
    setPaymentTargetId(row.id);
    setPaymentTargetLabel(`${displayInvoice(row)} — ${row.pihak}`);
    try {
      const res = await fetch(`/api/tagihan/${encodeURIComponent(row.id)}`, { credentials: "include" });
      const result = await res.json().catch(() => null);
      if (res.ok && result?.success) {
        setDetailData(result.data);
      }
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const openDokDetail = async (row: DokumenRow) => {
    setDokDetailRow(row);
    setDokDetailLoading(true);
    setDokDetailData(null);
    setDokTagihanData(null);
    try {
      const res = await fetch(`/api/penjualan/dokumen/${encodeURIComponent(row.id)}`, { credentials: "include" });
      const result = await res.json().catch(() => null);
      if (res.ok && result?.success) {
        setDokDetailData(result.data);
        const tagihanId = result.data?.tagihan?.id ?? result.data?.tagihanId ?? null;
        if (tagihanId) {
          setDokTagihanLoading(true);
          try {
            const tres = await fetch(`/api/tagihan/${encodeURIComponent(tagihanId)}`, { credentials: "include" });
            const tresult = await tres.json().catch(() => null);
            if (tres.ok && tresult?.success) {
              setDokTagihanData(tresult.data);
            }
          } catch {
            // ignore tagihan tambahan
          } finally {
            setDokTagihanLoading(false);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setDokDetailLoading(false);
    }
  };

  const openKirimDetail = async (row: PengirimanRow) => {
    setKirimDetailRow(row);
    setKirimDetailLoading(true);
    setKirimDetailData(null);
    try {
      const res = await fetch(`/api/penjualan/pengiriman/${encodeURIComponent(row.id)}`, { credentials: "include" });
      const result = await res.json().catch(() => null);
      if (res.ok && result?.success) {
        setKirimDetailData(result.data);
      }
    } catch {
      // ignore
    } finally {
      setKirimDetailLoading(false);
    }
  };

  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editRow) return;
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/penjualan/tagihan/${encodeURIComponent(editRow.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pihak: editForm.pihak.trim(),
          noInvoice: editForm.noInvoice.trim() || null,
          jenis: editForm.jenis || null,
          dokumen: editForm.dokumen || null,
          jatuhTempo: editForm.jatuhTempo || null,
          keterangan: editForm.keterangan.trim() || null,
          ...(!editLockedJumlah ? { jumlah: Number(editForm.jumlah) } : {}),
        }),
      });
      const result = await res.json().catch(() => ({ message: "Gagal menyimpan perubahan" }));
      if (!res.ok) {
        const detail = Array.isArray((result as { errors?: { message: string }[] }).errors)
          ? (result as { errors: { message: string }[] }).errors.map((x) => x.message).join("; ")
          : null;
        throw new Error(detail || result.message || "Gagal menyimpan perubahan");
      }
      setEditRow(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal menyimpan perubahan");
    } finally {
      setEditSaving(false);
    }
  };

  const submitPayment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!paymentTargetId) return;
    setPaymentSaving(true);
    setPaymentError("");
    try {
      const res = await fetch(`/api/tagihan/${encodeURIComponent(paymentTargetId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jumlahBayar: Number(paymentForm.jumlahBayar),
          sumberDana: paymentForm.sumberDana,
          tanggal: paymentForm.tanggal || undefined,
          keterangan: paymentForm.keterangan.trim() || undefined,
        }),
      });
      const result = await res.json().catch(() => ({ message: "Gagal mencatat pembayaran" }));
      if (!res.ok) {
        const detail = Array.isArray((result as { errors?: { message: string }[] }).errors)
          ? (result as { errors: { message: string }[] }).errors.map((x) => x.message).join("; ")
          : null;
        throw new Error(detail || result.message || "Gagal mencatat pembayaran");
      }
      setPaymentOpen(false);
      setDetailRow(null);
      setDetailData(null);
      setDokDetailRow(null);
      setDokDetailData(null);
      setDokTagihanData(null);
      setPaymentTargetId(null);
      router.refresh();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Gagal mencatat pembayaran");
    } finally {
      setPaymentSaving(false);
    }
  };

  // Union: baris tagihan + baris dokumen proforma/tukar faktur (yang tak punya piutang sendiri).
  const semuaBaris = useMemo<PenagihanRow[]>(() => {
    const docRows: PenagihanRow[] = docs
      .filter((d) => d.tipe === "PROFORMA" || d.tipe === "TUKAR_FAKTUR")
      .map((d) => ({
        kind: "dokumen" as const,
        id: d.id,
        docId: d.id,
        tanggal: d.tanggal,
        noInvoice: d.noDokumen,
        jenis: null,
        dokumen: d.tipe,
        pihak: d.pelanggan,
        keterangan: null,
        jatuhTempo: d.jatuhTempo,
        status: "BELUM_LUNAS" as const,
        docStatus: d.status,
        sisa: null,
        jumlah: d.total,
      }));
    return [...rows, ...docRows].sort(
      (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
    );
  }, [rows, docs]);

  const hapusDokumen = async (docId: string, label: string) => {
    if (!window.confirm(`Hapus dokumen ${label}? Piutang ikutannya (bila ada dan belum dibayar) ikut terhapus.`)) {
      return;
    }
    setDeletingId(docId);
    setActionError("");
    try {
      const res = await fetch(`/api/penjualan/dokumen/${encodeURIComponent(docId)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({ message: "Gagal menghapus dokumen" }));
      if (!res.ok) throw new Error(result.message || "Gagal menghapus dokumen");
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menghapus dokumen");
    } finally {
      setDeletingId(null);
    }
  };

  const editHref = (r: PenagihanRow) => {
    if (r.kind === "dokumen") return `/keuangan/penjualan/${SLUG_BY_TIPE[r.dokumen ?? ""] ?? "penagihan"}/${r.id}/ubah`;
    if (r.docId) return `/keuangan/penjualan/penagihan/${r.docId}/ubah`;
    return null;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return semuaBaris.filter((r) => {
      // Baris lama tanpa dokumen adalah penagihan nyata -> ikut filter "Penagihan".
      if (dokumen && (r.dokumen ?? "PENAGIHAN") !== dokumen) return false;
      if (!matchStatus(r, status)) return false;
      if (q) {
        const hay = `${r.noInvoice ?? ""} ${r.id} ${r.pihak}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [semuaBaris, dokumen, status, search]);

  const filteredKirim = useMemo(() => {
    const q = kirimSearch.trim().toLowerCase();
    return kirim.filter((p) => {
      if (kirimStatus && p.status !== kirimStatus) return false;
      if (q && !`${p.noPengiriman} ${p.pesananNo} ${p.pelanggan}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [kirim, kirimStatus, kirimSearch]);

  const hapusPenagihan = async (row: PenagihanRow) => {
    if (
      !window.confirm(`Hapus penagihan ${displayInvoice(row)} untuk ${row.pihak} sebesar Rp ${formatRupiah(row.jumlah)}?`)
    ) {
      return;
    }
    setDeletingId(row.id);
    setActionError("");
    try {
      const res = await fetch(`/api/tagihan/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({ message: "Gagal menghapus penagihan" }));
      if (!res.ok) throw new Error(result.message || "Gagal menghapus penagihan");
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menghapus penagihan");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Penjualan</h1>
          <p className="mt-1 text-sm text-slate-400">
            Penagihan, pengiriman, pesanan, dan penawaran PT Bumi Surya Farm
          </p>
        </div>
        <BuatPenjualanDropdown />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          label="Penagihan Belum Dibayar"
          value={summary.belumDibayar}
          note={`${summary.belumDibayarCount} penagihan terbuka`}
          tone="amber"
          Icon={FileText}
        />
        <SummaryCard
          label="Penagihan Telat Dibayar"
          value={summary.telatDibayar}
          note={`${summary.telatDibayarCount} lewat jatuh tempo`}
          tone="red"
          Icon={Clock}
        />
        <SummaryCard
          label="Pelunasan Diterima 30 Hari"
          value={summary.pelunasan30Hari}
          note={`${summary.pelunasan30Count} pelunasan 30 hari terakhir`}
          tone="green"
          Icon={TrendingUp}
        />
      </div>

      <div className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-medium">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              tab === t.key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "penagihan" && (
        <Card className="border-slate-200">
          <CardContent className="p-0">
            <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
              <Select value={dokumen} onChange={(e) => setDokumen(e.target.value)} className="sm:max-w-56">
                <option value="">Semua Jenis Transaksi</option>
                <option value="PENAGIHAN">Penagihan</option>
                <option value="PROFORMA">Faktur Proforma</option>
                <option value="TUKAR_FAKTUR">Tukar Faktur</option>
              </Select>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-56">
                <option value="">Semua Status</option>
                <option value="MENUNGGU">Menunggu Pembayaran</option>
                <option value="TELAT">Telat Bayar</option>
                <option value="LUNAS">Dibayar</option>
                <option value="LUNAS_SEBAGIAN">Dibayar Sebagian</option>
                <option value="BELUM_LUNAS">Belum Bayar</option>
              </Select>
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari no. invoice atau nama pelanggan..."
                  className="pl-9 pr-9"
                  aria-label="Cari no. invoice atau nama pelanggan"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    title="Bersihkan pencarian"
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {actionError && (
              <div className="border-b border-slate-100 px-4 py-2.5 text-xs text-red-600">{actionError}</div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>No. Invoice</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Tanggal Jatuh Tempo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sisa Tagihan</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                        {semuaBaris.length === 0 ? "Belum ada penagihan" : "Tidak ada penagihan yang cocok dengan filter"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => {
                      const st = displayStatus(r);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs text-slate-500">{formatDate(r.tanggal)}</TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => r.kind === "tagihan" && openDetail(r)}
                              className={`text-xs font-medium text-left ${r.kind === "tagihan" ? "text-slate-700 hover:text-slate-900 underline decoration-dotted" : "text-slate-700"}`}
                              title={r.noInvoice ?? r.id}
                            >
                              {displayInvoice(r)}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-700">{r.pihak}</div>
                            {r.jenis && (
                              <div className="text-[11px] text-slate-400">{JENIS_LABEL[r.jenis] ?? r.jenis}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">{formatDate(r.jatuhTempo)}</TableCell>
                          <TableCell>
                            <Badge variant={st.variant} className="text-[11px]">
                              {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium tracking-tight">
                            {r.sisa == null ? <span className="text-slate-300">—</span> : `Rp ${formatRupiah(r.sisa)}`}
                          </TableCell>
                          <TableCell className="text-right text-sm text-slate-500">
                            Rp {formatRupiah(r.jumlah)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {editHref(r) ? (
                                <Link
                                  href={editHref(r) as string}
                                  title="Ubah dengan form yang sama"
                                  aria-label={`Ubah ${displayInvoice(r)}`}
                                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 w-7 rounded-full")}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Link>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 rounded-full"
                                  title="Ubah penagihan"
                                  aria-label={`Ubah penagihan ${displayInvoice(r)}`}
                                  onClick={() => openEdit(r)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 w-7 rounded-full"
                                title={r.kind === "dokumen" ? "Hapus dokumen" : "Hapus penagihan"}
                                aria-label={`Hapus ${displayInvoice(r)}`}
                                disabled={deletingId === r.id}
                                onClick={() =>
                                  r.kind === "dokumen"
                                    ? hapusDokumen(r.id, `${displayInvoice(r)} — ${r.pihak}`)
                                    : hapusPenagihan(r)
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
              {filtered.length} dari {semuaBaris.length} penagihan
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(editRow)} onOpenChange={(v) => !v && setEditRow(null)}>
        <DialogContent onClose={() => setEditRow(null)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ubah Penagihan</DialogTitle>
            <DialogDescription>
              {editRow ? `${displayInvoice(editRow)} — ${editRow.pihak}` : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Pelanggan *</span>
                <Input
                  value={editForm.pihak}
                  onChange={(e) => setEditForm((f) => ({ ...f, pihak: e.target.value }))}
                  maxLength={100}
                  required
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-600">No. Invoice</span>
                <Input
                  value={editForm.noInvoice}
                  onChange={(e) => setEditForm((f) => ({ ...f, noInvoice: e.target.value }))}
                  maxLength={50}
                  placeholder="Otomatis bila dikosongkan"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-600">Tanggal Jatuh Tempo</span>
                <Input
                  type="date"
                  value={editForm.jatuhTempo}
                  onChange={(e) => setEditForm((f) => ({ ...f, jatuhTempo: e.target.value }))}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-600">Jenis Produk</span>
                <Select value={editForm.jenis} onChange={(e) => setEditForm((f) => ({ ...f, jenis: e.target.value }))}>
                  <option value="">—</option>
                  <option value="HASIL_KEBUN">Hasil Kebun</option>
                  <option value="TERNAK">Ternak</option>
                  <option value="IKAN">Ikan</option>
                  <option value="LAINNYA">Lainnya</option>
                </Select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-600">Jenis Dokumen</span>
                <Select value={editForm.dokumen} onChange={(e) => setEditForm((f) => ({ ...f, dokumen: e.target.value }))}>
                  <option value="">Penagihan</option>
                  <option value="PENAGIHAN">Penagihan</option>
                  <option value="PROFORMA">Faktur Proforma</option>
                  <option value="TUKAR_FAKTUR">Tukar Faktur</option>
                </Select>
              </label>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Total (Rp)</span>
                <Input
                  type="number"
                  min="1000"
                  step="any"
                  value={editForm.jumlah}
                  onChange={(e) => setEditForm((f) => ({ ...f, jumlah: e.target.value }))}
                  disabled={editLockedJumlah}
                  required
                />
                {editLockedJumlah && (
                  <span className="text-[11px] text-slate-400">
                    Total dikunci karena sudah ada pembayaran tercatat.
                  </span>
                )}
              </label>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Keterangan</span>
                <Textarea
                  value={editForm.keterangan}
                  onChange={(e) => setEditForm((f) => ({ ...f, keterangan: e.target.value }))}
                  placeholder="Opsional"
                />
              </label>
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Penagihan */}
      <Dialog open={Boolean(detailRow)} onOpenChange={(v) => !v && setDetailRow(null)}>
        <DialogContent onClose={() => setDetailRow(null)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Penagihan</DialogTitle>
            <DialogDescription>
              {detailRow ? `${displayInvoice(detailRow)} — ${detailRow.pihak}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">Memuat detail...</p>
          ) : detailData ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Invoice</div>
                  <div className="font-medium truncate max-w-full">{detailData.noInvoice || detailData.id}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Tanggal</div>
                  <div>{formatDate(detailData.tanggal)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Jatuh Tempo</div>
                  <div>{formatDate(detailData.jatuhTempo)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Status</div>
                  <div>
                    <Badge variant={detailData.status === "LUNAS" ? "sehat" : detailData.status === "LUNAS_SEBAGIAN" ? "info" : "warning"} className="text-[11px]">
                      {detailData.status === "LUNAS" ? "Dibayar" : detailData.status === "LUNAS_SEBAGIAN" ? "Dibayar Sebagian" : "Menunggu Pembayaran"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Total</div>
                  <div className="font-medium">Rp {formatRupiah(detailData.jumlah)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Sisa</div>
                  <div className="font-medium">Rp {formatRupiah(detailData.sisa)}</div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600">Detail Produk</div>
                <div className="max-h-48 overflow-auto rounded-lg border border-slate-100">
                  {detailData.items?.length ? (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Produk</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-left">Satuan</th>
                          <th className="px-3 py-2 text-right">Harga Satuan</th>
                          <th className="px-3 py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.items.map((it: any) => (
                          <tr key={it.id} className="border-t border-slate-100">
                            <td className="px-3 py-2">{it.deskripsi}</td>
                            <td className="px-3 py-2 text-right">{Number(it.kuantitas).toLocaleString("id-ID")}</td>
                            <td className="px-3 py-2">{it.unit}</td>
                            <td className="px-3 py-2 text-right">Rp {formatRupiah(it.harga)}</td>
                            <td className="px-3 py-2 text-right font-medium">Rp {formatRupiah(it.jumlah)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="px-3 py-6 text-center text-slate-400">
                      {detailData.dokumenId
                        ? "Dokumen penagihan tidak memiliki rincian produk"
                        : "Penagihan lama tanpa rincian produk (dibuat sebelum modul dokumen)"}
                    </p>
                  )}
                </div>
                {detailData.dokumenId && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>
                      Dokumen: {detailData.dokumenNo || detailData.dokumenId}
                      {detailData.referensiIds?.length ? ` · Dari: ${detailData.referensiIds.length} dokumen asal` : ""}
                    </span>
                    <Link
                      href={`/keuangan/penjualan/penagihan/${detailData.dokumenId}`}
                      className="font-medium text-green-700 hover:underline"
                    >
                      Lihat dokumen
                    </Link>
                  </div>
                )}
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600">Riwayat Pembayaran</div>
                <div className="max-h-48 overflow-auto rounded-lg border border-slate-100">
                  {detailData.pembayaran?.length ? (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Tanggal</th>
                          <th className="px-3 py-2 text-left">Kas/Bank</th>
                          <th className="px-3 py-2 text-left">Akun COA</th>
                          <th className="px-3 py-2 text-right">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.pembayaran.map((p: any) => (
                          <tr key={p.id} className="border-t border-slate-100">
                            <td className="px-3 py-2">{formatDate(p.tanggal)}</td>
                            <td className="px-3 py-2">{p.sumberDana}</td>
                            <td className="px-3 py-2">{p.kodeAkun ? `${p.kodeAkun} - ` : ""}{p.kategori ?? p.kodeAkun ?? "—"}</td>
                            <td className="px-3 py-2 text-right">Rp {formatRupiah(p.jumlah)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="px-3 py-6 text-center text-slate-400">Belum ada pembayaran</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDetailRow(null)}>Tutup</Button>
                {detailData.status !== "LUNAS" && detailData.sisa > 0 && (
                  <Button onClick={() => { setPaymentOpen(true); setPaymentForm({ jumlahBayar: "", sumberDana: "KAS", tanggal: todayInputLocal(), keterangan: "" }); }}>Terima Pembayaran</Button>
                )}
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">Gagal memuat detail</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Form Penerimaan Pembayaran */}
      <Dialog open={paymentOpen} onOpenChange={(v) => { if (!v) setPaymentOpen(false); }}>
        <DialogContent onClose={() => setPaymentOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Terima Pembayaran</DialogTitle>
            <DialogDescription>
              {paymentTargetLabel || (detailRow ? `${displayInvoice(detailRow)} — ${detailRow.pihak}` : "")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPayment} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-600">Jumlah Pembayaran *</span>
                <Input
                  type="number"
                  min="1000"
                  step="any"
                  required
                  value={paymentForm.jumlahBayar}
                  onChange={(e) => setPaymentForm(f => ({ ...f, jumlahBayar: e.target.value }))}
                  placeholder="Rp"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-600">Akun Kas/Bank/Tabungan *</span>
                <Select value={paymentForm.sumberDana} onChange={(e) => setPaymentForm(f => ({ ...f, sumberDana: e.target.value as any }))}>
                  <option value="KAS">Kas</option>
                  <option value="BANK">Bank</option>
                  <option value="TABUNGAN">Tabungan</option>
                </Select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-600">Tanggal</span>
                <Input type="date" value={paymentForm.tanggal} onChange={(e) => setPaymentForm(f => ({ ...f, tanggal: e.target.value }))} />
              </label>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Keterangan</span>
                <Input value={paymentForm.keterangan} onChange={(e) => setPaymentForm(f => ({ ...f, keterangan: e.target.value }))} placeholder="Opsional" />
              </label>
            </div>
            {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)} disabled={paymentSaving}>Batal</Button>
              <Button type="submit" disabled={paymentSaving}>{paymentSaving ? "Menyimpan..." : "Buat Penerimaan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Pesanan / Penawaran — popup seperti Detail Penagihan */}
      <Dialog open={Boolean(dokDetailRow)} onOpenChange={(v) => { if (!v) { setDokDetailRow(null); setDokDetailData(null); setDokTagihanData(null); } }}>
        <DialogContent onClose={() => { setDokDetailRow(null); setDokDetailData(null); setDokTagihanData(null); }} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dokDetailRow?.tipe === "PENAWARAN" ? "Detail Penawaran" : "Detail Pesanan"}
            </DialogTitle>
            <DialogDescription>
              {dokDetailRow ? `${dokDetailRow.noDokumen} — ${dokDetailRow.pelanggan}` : ""}
            </DialogDescription>
          </DialogHeader>
          {dokDetailLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">Memuat detail...</p>
          ) : dokDetailData ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Tanggal</div>
                  <div>{formatDate(dokDetailData.tanggal)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Jatuh Tempo</div>
                  <div>{formatDate(dokDetailData.jatuhTempo)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Status</div>
                  <div>
                    {(() => {
                      const raw = dokDetailData.status as string;
                      const tipe = (dokDetailData.tipe ?? dokDetailRow?.tipe ?? "") as string;
                      const norm =
                        tipe === "PESANAN" || tipe === "PENAWARAN"
                          ? raw === "TERBUKA" || raw === "PESANAN" || raw === "PESANAN_PROFORMA"
                            ? "BELUM_DITAGIH"
                            : raw === "DITUTUP"
                              ? "SELESAI"
                              : raw
                          : raw;
                      return (
                        <Badge variant={DOC_STATUS_VARIANT[norm] ?? "secondary"} className="text-[11px]">
                          {DOC_STATUS_LABEL[norm] ?? norm}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Total</div>
                  <div className="font-medium">Rp {formatRupiah(dokDetailData.total)}</div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600">Detail Produk</div>
                <div className="max-h-48 overflow-auto rounded-lg border border-slate-100">
                  {dokDetailData.items?.length ? (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Produk</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-left">Satuan</th>
                          <th className="px-3 py-2 text-right">Harga Satuan</th>
                          <th className="px-3 py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dokDetailData.items.map((it: any) => (
                          <tr key={it.id} className="border-t border-slate-100">
                            <td className="px-3 py-2">{it.deskripsi}</td>
                            <td className="px-3 py-2 text-right">{Number(it.kuantitas).toLocaleString("id-ID")}</td>
                            <td className="px-3 py-2">{it.unit}</td>
                            <td className="px-3 py-2 text-right">Rp {formatRupiah(it.harga)}</td>
                            <td className="px-3 py-2 text-right font-medium">Rp {formatRupiah(it.jumlah)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="px-3 py-6 text-center text-slate-400">Tidak ada rincian produk</p>
                  )}
                </div>
              </div>
              {dokDetailData.tagihan || dokTagihanData ? (
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-600">Piutang Terkait</div>
                  {dokTagihanLoading ? (
                    <p className="text-xs text-slate-500">Memuat piutang...</p>
                  ) : dokTagihanData ? (
                    <div className="grid gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant={dokTagihanData.status === "LUNAS" ? "sehat" : dokTagihanData.status === "LUNAS_SEBAGIAN" ? "info" : "warning"} className="text-[11px]">
                          {dokTagihanData.status === "LUNAS" ? "Dibayar" : dokTagihanData.status === "LUNAS_SEBAGIAN" ? "Dibayar Sebagian" : "Menunggu Pembayaran"}
                        </Badge>
                        <span className="text-slate-500">Sisa Rp {formatRupiah(dokTagihanData.sisa)} dari Rp {formatRupiah(dokTagihanData.jumlah)}</span>
                      </div>
                      <div className="max-h-40 overflow-auto rounded-lg border border-slate-100">
                        {dokTagihanData.pembayaran?.length ? (
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                              <tr>
                                <th className="px-3 py-2 text-left">Tanggal</th>
                                <th className="px-3 py-2 text-left">Kas/Bank</th>
                                <th className="px-3 py-2 text-right">Jumlah</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dokTagihanData.pembayaran.map((p: any) => (
                                <tr key={p.id} className="border-t border-slate-100">
                                  <td className="px-3 py-2">{formatDate(p.tanggal)}</td>
                                  <td className="px-3 py-2">{p.sumberDana}</td>
                                  <td className="px-3 py-2 text-right">Rp {formatRupiah(p.jumlah)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="px-3 py-4 text-center text-slate-400">Belum ada pembayaran</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {dokDetailData.tagihan?.noInvoice ?? "Sudah menjadi penagihan"} · Sisa Rp {formatRupiah(dokDetailData.tagihan?.sisa ?? 0)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  Belum menjadi penagihan — belum ada piutang & pembayaran. Buat penagihan dulu untuk membayar.
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setDokDetailRow(null); setDokDetailData(null); setDokTagihanData(null); }}>Tutup</Button>
                {dokDetailRow && (
                  <Link
                    href={`/keuangan/penjualan/${SLUG_BY_TIPE[dokDetailRow.tipe] ?? dokDetailRow.tipe.toLowerCase()}/${dokDetailRow.id}`}
                    className={cn(buttonVariants({ variant: "outline" }))}
                  >
                    Lihat halaman
                  </Link>
                )}
                {dokTagihanData && dokTagihanData.status !== "LUNAS" && Number(dokTagihanData.sisa) > 0 && (
                  <Button onClick={() => { setPaymentTargetId(dokTagihanData.id); setPaymentTargetLabel(`${dokTagihanData.noInvoice ?? dokDetailRow?.noDokumen} — ${dokDetailRow?.pelanggan}`); setPaymentForm({ jumlahBayar: "", sumberDana: "KAS", tanggal: todayInputLocal(), keterangan: "" }); setPaymentError(""); setPaymentOpen(true); }}>Terima Pembayaran</Button>
                )}
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">Gagal memuat detail</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Pengiriman — popup seperti Detail Penagihan (tanpa pembayaran) */}
      <Dialog open={Boolean(kirimDetailRow)} onOpenChange={(v) => { if (!v) { setKirimDetailRow(null); setKirimDetailData(null); } }}>
        <DialogContent onClose={() => { setKirimDetailRow(null); setKirimDetailData(null); }} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Pengiriman</DialogTitle>
            <DialogDescription>
              {kirimDetailRow ? `${kirimDetailRow.noPengiriman} — ${kirimDetailRow.pelanggan}` : ""}
            </DialogDescription>
          </DialogHeader>
          {kirimDetailLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">Memuat detail...</p>
          ) : kirimDetailData ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Tgl. Pengiriman</div>
                  <div>{formatDate(kirimDetailData.tanggalPengiriman ?? kirimDetailData.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Nomor Pesanan</div>
                  <div>{kirimDetailData.pesanan?.noDokumen ?? kirimDetailRow?.pesananNo}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Transaksi</div>
                  <div>{kirimDetailData.noTransaksi || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Kirim Melalui</div>
                  <div>{kirimDetailData.kirimMelalui || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Pelacakan</div>
                  <div>{kirimDetailData.noPelacakan || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Gudang</div>
                  <div>{kirimDetailData.gudang || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Referensi Pelanggan</div>
                  <div>{kirimDetailData.noRefPelanggan || "—"}</div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600">Detail Produk</div>
                <div className="max-h-48 overflow-auto rounded-lg border border-slate-100">
                  {kirimDetailData.items?.length ? (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Produk</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-left">Satuan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kirimDetailData.items.map((it: any) => (
                          <tr key={it.id} className="border-t border-slate-100">
                            <td className="px-3 py-2">{it.deskripsi}</td>
                            <td className="px-3 py-2 text-right">{Number(it.kuantitas).toLocaleString("id-ID")}</td>
                            <td className="px-3 py-2">{it.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="px-3 py-6 text-center text-slate-400">Tidak ada rincian produk</p>
                  )}
                </div>
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  Pengiriman tidak mencatat pemasukan — piutang baru terbentuk saat dibuat Penagihan.
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setKirimDetailRow(null); setKirimDetailData(null); }}>Tutup</Button>
                {kirimDetailRow && (
                  <Link href={`/keuangan/penjualan/pengiriman/${kirimDetailRow.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                    Lihat halaman
                  </Link>
                )}
                {kirimDetailRow && (
                  <Link href={`/keuangan/penjualan/penagihan/baru?dariPengiriman=${kirimDetailRow.id}`} className={cn(buttonVariants({}))}>
                    Buat Penagihan
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">Gagal memuat detail</p>
          )}
        </DialogContent>
      </Dialog>

      {tab === "pengiriman" && (
        <Card className="border-slate-200">
          <CardContent className="p-0">
            <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
              <Select value={kirimStatus} onChange={(e) => setKirimStatus(e.target.value)} className="sm:max-w-56">
                <option value="">Semua Status</option>
                <option value="BELUM_DITAGIH">Belum Ditagih</option>
                <option value="SELESAI">Selesai</option>
              </Select>
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={kirimSearch}
                  onChange={(e) => setKirimSearch(e.target.value)}
                  placeholder="Cari no. pengiriman atau nama pelanggan..."
                  className="pl-9 pr-9"
                  aria-label="Cari no. pengiriman atau nama pelanggan"
                />
                {kirimSearch && (
                  <button
                    type="button"
                    onClick={() => setKirimSearch("")}
                    title="Bersihkan pencarian"
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>No. Pengiriman</TableHead>
                    <TableHead>No. Pesanan Asal</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Item</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKirim.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                        {kirim.length === 0 ? "Belum ada pengiriman barang" : "Tidak ada pengiriman yang cocok dengan filter"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredKirim.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs text-slate-500">{formatDate(p.tanggal)}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => openKirimDetail(p)}
                            className="text-left text-xs font-medium text-slate-700 underline decoration-dotted hover:text-slate-900"
                            title={p.noPengiriman}
                          >
                            {p.noPengiriman}
                          </button>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{p.pesananNo}</TableCell>
                        <TableCell className="text-sm text-slate-700">{p.pelanggan}</TableCell>
                        <TableCell>
                          <Badge variant={DOC_STATUS_VARIANT[p.status] ?? "secondary"} className="text-[11px]">
                            {DOC_STATUS_LABEL[p.status] ?? p.status ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{p.jumlahItem} baris</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 rounded-full"
                              title="Lihat detail pengiriman"
                              aria-label={`Detail ${p.noPengiriman}`}
                              onClick={() => openKirimDetail(p)}
                            >
                              <Search className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 w-7 rounded-full"
                              title="Hapus pengiriman"
                              aria-label={`Hapus ${p.noPengiriman}`}
                              disabled={deletingId === p.id}
                              onClick={async () => {
                                if (!window.confirm(`Hapus pengiriman ${p.noPengiriman}? Tidak memengaruhi keuangan.`)) return;
                                setDeletingId(p.id);
                                setActionError("");
                                try {
                                  const res = await fetch(`/api/penjualan/pengiriman/${encodeURIComponent(p.id)}`, { method: "DELETE" });
                                  const result = await res.json().catch(() => ({ message: "Gagal menghapus pengiriman" }));
                                  if (!res.ok) throw new Error(result.message || "Gagal menghapus pengiriman");
                                  router.refresh();
                                } catch (e) {
                                  setActionError(e instanceof Error ? e.message : "Gagal menghapus pengiriman");
                                } finally {
                                  setDeletingId(null);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
              {filteredKirim.length} dari {kirim.length} pengiriman · Pengiriman tidak memengaruhi Kas/Piutang
            </div>
          </CardContent>
        </Card>
      )}
      {tab === "pesanan" && (
        <DokumenTable
          rows={docs.filter((d) => d.tipe === "PESANAN")}
          tempoLabel="Target / Jatuh Tempo"
          noLabel="No. Pesanan"
          emptyText="Belum ada pesanan penjualan"
          deletingId={deletingId}
          onDelete={hapusDokumen}
          allowedStatuses={["BELUM_DITAGIH", "SELESAI"]}
          onOpenDetail={openDokDetail}
        />
      )}
      {tab === "penawaran" && (
        <DokumenTable
          rows={docs.filter((d) => d.tipe === "PENAWARAN")}
          tempoLabel="Tanggal Kedaluwarsa"
          noLabel="No. Penawaran"
          emptyText="Belum ada penawaran penjualan"
          deletingId={deletingId}
          onDelete={hapusDokumen}
          allowedStatuses={["BELUM_DITAGIH", "SELESAI"]}
          onOpenDetail={openDokDetail}
        />
      )}

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
        <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Alur: Penawaran → Pesanan → Pengiriman → Faktur Proforma → Tukar Faktur → Penagihan → Piutang →
        Pembayaran (Hutang & Piutang) → Kas & Bank → COA. Faktur Proforma dapat dibuat dari Pesanan/Pengiriman,
        bukan dari Tukar Faktur.
      </p>
    </div>
  );
}
