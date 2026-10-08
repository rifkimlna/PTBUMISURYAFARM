"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  Upload,
  X,
} from "lucide-react";
import { cn, formatRupiah } from "@/lib/utils";

// Halaman Pembelian PT BST. Tab Faktur memakai data nyata (FakturPembelian +
// Tagihan HUTANG); tab lain masih tahap UI (empty state, tanpa dummy).

type TabKey = "faktur" | "tukar-faktur" | "pengiriman" | "pesanan" | "penawaran" | "permintaan";

const TABS: { key: TabKey; label: string }[] = [
  { key: "faktur", label: "Faktur" },
  { key: "tukar-faktur", label: "Tukar Faktur" },
  { key: "pengiriman", label: "Pengiriman" },
  { key: "pesanan", label: "Pesanan" },
  { key: "penawaran", label: "Penawaran" },
  { key: "permintaan", label: "Permintaan" },
];

export type FakturRow = {
  id: string;
  noFaktur: string;
  supplier: string;
  tanggal: string;
  jatuhTempo: string | null;
  status: "BELUM_LUNAS" | "LUNAS_SEBAGIAN" | "LUNAS";
  telat: boolean;
  sisa: number;
  total: number;
  tagihanId: string | null;
};

export type PembelianSummary = {
  belumDibayar: number;
  belumDibayarCount: number;
  telatDibayar: number;
  telatDibayarCount: number;
  pelunasan30Hari: number;
  pelunasan30Count: number;
};

export type DokumenBeliRow = {
  id: string;
  tipe: "PERMINTAAN" | "PENAWARAN" | "PESANAN";
  noDokumen: string;
  pihak: string;
  tanggal: string;
  jatuhTempo: string | null;
  status: string;
  total: number;
};

export type PengirimanBeliRow = {
  id: string;
  noPengiriman: string;
  pesananId: string;
  pesananNo: string;
  supplier: string;
  tanggal: string;
  jumlahItem: number;
  status: string;
};

const SLUG_DOK_BELI: Record<string, string> = {
  PERMINTAAN: "permintaan",
  PENAWARAN: "penawaran",
  PESANAN: "pesanan",
};

// Menu "Buat Pembelian Baru" — semua tombol berfungsi.
const BUAT_ITEMS = [
  { href: "/keuangan/pembelian/faktur/baru", label: "Faktur Pembelian", desc: "Tagihan dari supplier", Icon: ScrollText },
  { href: "/keuangan/pembelian/tukar-faktur/baru", label: "Tukar Faktur", desc: "Penagihan atas faktur berjalan", Icon: ArrowLeftRight },
  { href: "/keuangan/pembelian/pemesanan/baru", label: "Pemesanan Pembelian", desc: "Purchase order ke supplier", Icon: ShoppingCart },
  { href: "/keuangan/pembelian/penawaran/baru", label: "Penawaran Pembelian", desc: "Penawaran harga dari supplier", Icon: Tags },
  { href: "/keuangan/pembelian/permintaan/baru", label: "Permintaan Pembelian", desc: "Permintaan barang internal", Icon: ClipboardList },
];

const STATUS_FILTER_FAKTUR = [
  { value: "", label: "Semua Status" },
  { value: "MENUNGGU", label: "Menunggu Pembayaran" },
  { value: "TELAT", label: "Telat Bayar" },
  { value: "LUNAS", label: "Dibayar" },
  { value: "LUNAS_SEBAGIAN", label: "Dibayar Sebagian" },
  { value: "BELUM_LUNAS", label: "Belum Dibayar" },
];

const STATUS_FILTER: Record<Exclude<TabKey, "faktur">, { value: string; label: string }[]> = {
  "tukar-faktur": [
    { value: "", label: "Semua Status" },
    { value: "belum-ditagih", label: "Belum Ditagih" },
    { value: "telat", label: "Telat Bayar" },
    { value: "dibayar", label: "Dibayar" },
  ],
  pengiriman: [
    { value: "", label: "Semua Status" },
    { value: "belum-ditagih", label: "Belum Ditagih" },
    { value: "selesai", label: "Selesai" },
  ],
  pesanan: [
    { value: "", label: "Semua Status" },
    { value: "belum-ditagih", label: "Belum Ditagih" },
    { value: "sebagian", label: "Dikirim Sebagian" },
    { value: "selesai", label: "Selesai" },
  ],
  penawaran: [
    { value: "", label: "Semua Status" },
    { value: "belum-ditagih", label: "Belum Ditagih" },
    { value: "selesai", label: "Selesai" },
  ],
  permintaan: [
    { value: "", label: "Semua Status" },
    { value: "belum-ditagih", label: "Belum Ditagih" },
    { value: "sebagian", label: "Dibayar Sebagian" },
    { value: "selesai", label: "Selesai" },
  ],
};

const KOLOM: Record<Exclude<TabKey, "faktur">, { head: string[]; emptyText: string; searchPh: string }> = {
  "tukar-faktur": {
    head: ["Tanggal", "No. Tukar Faktur", "Supplier", "Tanggal Jatuh Tempo", "Status", "Total"],
    emptyText: "Belum ada tukar faktur pembelian",
    searchPh: "Cari no. tukar faktur atau nama supplier...",
  },
  pengiriman: {
    head: ["Tanggal", "No. Pengiriman", "No. Pesanan", "Supplier", "Status"],
    emptyText: "Belum ada pengiriman pembelian",
    searchPh: "Cari no. pengiriman atau nama supplier...",
  },
  pesanan: {
    head: ["Tanggal", "No. Pesanan", "Supplier", "Target / Jatuh Tempo", "Status", "Total"],
    emptyText: "Belum ada pesanan pembelian",
    searchPh: "Cari no. pesanan atau nama supplier...",
  },
  penawaran: {
    head: ["Tanggal", "No. Penawaran", "Supplier", "Tanggal Kedaluwarsa", "Status", "Total"],
    emptyText: "Belum ada penawaran pembelian",
    searchPh: "Cari no. penawaran atau nama supplier...",
  },
  permintaan: {
    head: ["Tanggal", "No. Permintaan", "Departemen", "Tanggal Dibutuhkan", "Status"],
    emptyText: "Belum ada permintaan pembelian",
    searchPh: "Cari no. permintaan atau departemen...",
  },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function displayStatus(r: FakturRow): { label: string; variant: "sehat" | "destructive" | "info" | "warning" } {
  if (r.status === "LUNAS") return { label: "Dibayar", variant: "sehat" };
  if (r.telat) return { label: "Telat Bayar", variant: "destructive" };
  if (r.status === "LUNAS_SEBAGIAN") return { label: "Dibayar Sebagian", variant: "info" };
  return { label: "Menunggu Pembayaran", variant: "warning" };
}

function matchStatus(r: FakturRow, f: string) {
  switch (f) {
    case "LUNAS":
      return r.status === "LUNAS";
    case "LUNAS_SEBAGIAN":
      return r.status === "LUNAS_SEBAGIAN";
    case "BELUM_LUNAS":
      return r.status === "BELUM_LUNAS";
    case "TELAT":
      return r.telat;
    case "MENUNGGU":
      return r.status !== "LUNAS" && !r.telat;
    default:
      return true;
  }
}

function BuatPembelianDropdown() {
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
        <Plus className="h-4 w-4" /> Buat Pembelian Baru
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {BUAT_ITEMS.map(({ href, label, desc, Icon }) => {
            const inner = (
              <>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-slate-900">{label}</span>
                  <span className="block text-xs text-slate-500">{desc}{!href ? " (Segera hadir)" : ""}</span>
                </span>
              </>
            );
            return href ? (
              <Link
                key={label}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
              >
                {inner}
              </Link>
            ) : (
              <button
                key={label}
                type="button"
                role="menuitem"
                title="Segera hadir"
                disabled
                className="flex w-full cursor-not-allowed items-start gap-3 px-4 py-3 text-left opacity-60"
              >
                {inner}
              </button>
            );
          })}
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
        <div className={`mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${tones.text}`}>
          Rp {formatRupiah(value)}
        </div>
        <div className="mt-1.5 text-xs text-slate-400">{note}</div>
      </CardContent>
    </Card>
  );
}

function EmptyTabTable({ tabKey }: { tabKey: Exclude<TabKey, "faktur"> }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const meta = KOLOM[tabKey];

  return (
    <Card className="border-slate-200">
      <CardContent className="p-0">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-56" aria-label="Filter status">
            {STATUS_FILTER[tabKey].map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={meta.searchPh}
              className="pl-9 pr-9"
              aria-label={meta.searchPh}
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
              <TableRow className="bg-slate-50">
                {meta.head.map((h) => (
                  <TableHead key={h} className={h === "Total" ? "text-right" : undefined}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={meta.head.length} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <PackageSearch className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium text-slate-500">{meta.emptyText}</p>
                    <p className="text-xs text-slate-400">Data akan tampil setelah fungsi pembelian dibuat.</p>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-400">0 dari 0 dokumen</div>
      </CardContent>
    </Card>
  );
}

// Tabel dokumen pembelian per tab: klik No. membuka popup seperti Penjualan.
function DokumenBeliTable({
  rows,
  tempoLabel,
  noLabel,
  pihakLabel,
  emptyText,
  deletingId,
  onDelete,
  onOpenDetail,
}: {
  rows: DokumenBeliRow[];
  tempoLabel: string;
  noLabel: string;
  pihakLabel: string;
  emptyText: string;
  deletingId: string | null;
  onDelete: (row: DokumenBeliRow) => void;
  onOpenDetail: (row: DokumenBeliRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (q && !`${r.noDokumen} ${r.id} ${r.pihak}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, status, search]);

  return (
    <Card className="border-slate-200">
      <CardContent className="p-0">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-56">
            <option value="">Semua Status</option>
            <option value="BELUM_DITAGIH">Belum Ditagih</option>
            <option value="SELESAI">Selesai</option>
          </Select>
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. dokumen atau nama..."
              className="pl-9 pr-9"
              aria-label="Cari no. dokumen atau nama"
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
                <TableHead>{pihakLabel}</TableHead>
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
                        onClick={() => onOpenDetail(r)}
                        className="text-left text-slate-700 underline decoration-dotted hover:text-slate-900"
                        title={r.noDokumen}
                      >
                        {r.noDokumen}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{r.pihak}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(r.jatuhTempo)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "SELESAI" ? "sehat" : "gray"} className="text-[11px]">
                        {r.status === "SELESAI" ? "Selesai" : "Belum Ditagih"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tracking-tight">
                      Rp {formatRupiah(r.total)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/keuangan/pembelian/dokumen/${SLUG_DOK_BELI[r.tipe]}/${r.id}/ubah`}
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
                          onClick={() => onDelete(r)}
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

export function PembelianContent({
  summary,
  faktur,
  docs,
  kirim,
  initialTab,
}: {
  summary: PembelianSummary;
  faktur: FakturRow[];
  docs: DokumenBeliRow[];
  kirim: PengirimanBeliRow[];
  initialTab: TabKey;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [kirimStatus, setKirimStatus] = useState("");
  const [kirimSearch, setKirimSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [dokDetailRow, setDokDetailRow] = useState<DokumenBeliRow | null>(null);
  const [dokDetailData, setDokDetailData] = useState<any>(null);
  const [dokDetailLoading, setDokDetailLoading] = useState(false);
  const [dokBusy, setDokBusy] = useState(false);
  const [dokError, setDokError] = useState("");
  const [kirimDetailRow, setKirimDetailRow] = useState<PengirimanBeliRow | null>(null);
  const [kirimDetailData, setKirimDetailData] = useState<any>(null);
  const [kirimDetailLoading, setKirimDetailLoading] = useState(false);
  const [detailRow, setDetailRow] = useState<FakturRow | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentTargetId, setPaymentTargetId] = useState<string | null>(null);
  const [paymentTargetLabel, setPaymentTargetLabel] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const todayInputLocal = () => new Date(new Date().toDateString()).toISOString().slice(0, 10);
  const [paymentForm, setPaymentForm] = useState({ jumlahBayar: "", sumberDana: "KAS" as "KAS" | "BANK" | "TABUNGAN", tanggal: todayInputLocal(), keterangan: "" });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const openDetail = async (row: FakturRow) => {
    setDetailRow(row);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/pembelian/faktur/${encodeURIComponent(row.id)}`, { credentials: "include" });
      const result = await res.json().catch(() => null);
      if (res.ok && result?.success) {
        setDetailData(result.data);
        const tagihan = result.data?.tagihan;
        if (tagihan?.id) {
          setPaymentTargetId(tagihan.id);
          setPaymentTargetLabel(`${row.noFaktur} — ${row.supplier}`);
        } else {
          setPaymentTargetId(null);
          setPaymentTargetLabel("");
        }
      }
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
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
      setPaymentTargetId(null);
      router.refresh();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Gagal mencatat pembayaran");
    } finally {
      setPaymentSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faktur.filter((r) => {
      if (!matchStatus(r, status)) return false;
      if (q && !`${r.noFaktur} ${r.supplier}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [faktur, status, search]);

  const hapusFaktur = async (row: FakturRow) => {
    if (!window.confirm(`Hapus faktur ${row.noFaktur} dari ${row.supplier} sebesar Rp ${formatRupiah(row.total)}?`)) {
      return;
    }
    setDeletingId(row.id);
    setActionError("");
    try {
      const res = await fetch(`/api/pembelian/faktur/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({ message: "Gagal menghapus faktur" }));
      if (!res.ok) throw new Error(result.message || "Gagal menghapus faktur");
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menghapus faktur");
    } finally {
      setDeletingId(null);
    }
  };

  const openDokDetail = async (row: DokumenBeliRow) => {
    setDokDetailRow(row);
    setDokDetailLoading(true);
    setDokDetailData(null);
    setDokError("");
    try {
      const res = await fetch(`/api/pembelian/dokumen/${encodeURIComponent(row.id)}`, { credentials: "include" });
      const result = await res.json().catch(() => null);
      if (res.ok && result?.success) setDokDetailData(result.data);
    } catch {
      // ignore
    } finally {
      setDokDetailLoading(false);
    }
  };

  const openKirimDetail = async (row: PengirimanBeliRow) => {
    setKirimDetailRow(row);
    setKirimDetailLoading(true);
    setKirimDetailData(null);
    try {
      const res = await fetch(`/api/pembelian/pengiriman/${encodeURIComponent(row.id)}`, { credentials: "include" });
      const result = await res.json().catch(() => null);
      if (res.ok && result?.success) setKirimDetailData(result.data);
    } catch {
      // ignore
    } finally {
      setKirimDetailLoading(false);
    }
  };

  const toggleDok = async () => {
    if (!dokDetailRow) return;
    const selesai = (dokDetailData?.status ?? dokDetailRow.status) === "SELESAI";
    setDokBusy(true);
    setDokError("");
    try {
      const res = await fetch(`/api/pembelian/dokumen/${encodeURIComponent(dokDetailRow.id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selesai ? "BELUM_DITAGIH" : "SELESAI" }),
      });
      const result = await res.json().catch(() => ({ message: "Gagal ubah status" }));
      if (!res.ok) throw new Error(result.message || "Gagal ubah status");
      setDokDetailRow(null);
      setDokDetailData(null);
      router.refresh();
    } catch (e) {
      setDokError(e instanceof Error ? e.message : "Gagal ubah status");
    } finally {
      setDokBusy(false);
    }
  };

  const hapusDokumen = async () => {
    if (!dokDetailRow) return;
    if (!window.confirm(`Hapus ${dokDetailRow.noDokumen} — ${dokDetailRow.pihak}?`)) return;
    setDokBusy(true);
    setDokError("");
    try {
      const res = await fetch(`/api/pembelian/dokumen/${encodeURIComponent(dokDetailRow.id)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({ message: "Gagal menghapus dokumen" }));
      if (!res.ok) throw new Error(result.message || "Gagal menghapus dokumen");
      setDokDetailRow(null);
      setDokDetailData(null);
      router.refresh();
    } catch (e) {
      setDokError(e instanceof Error ? e.message : "Gagal menghapus dokumen");
    } finally {
      setDokBusy(false);
    }
  };

  const hapusDokumenRow = async (row: DokumenBeliRow) => {
    if (!window.confirm(`Hapus ${row.noDokumen} — ${row.pihak}?`)) return;
    setDeletingId(row.id);
    setActionError("");
    try {
      const res = await fetch(`/api/pembelian/dokumen/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({ message: "Gagal menghapus dokumen" }));
      if (!res.ok) throw new Error(result.message || "Gagal menghapus dokumen");
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menghapus dokumen");
    } finally {
      setDeletingId(null);
    }
  };

  const hapusKirim = async (row: PengirimanBeliRow) => {
    if (!window.confirm(`Hapus penerimaan ${row.noPengiriman}? Tidak memengaruhi keuangan.`)) return;
    setDeletingId(row.id);
    setActionError("");
    try {
      const res = await fetch(`/api/pembelian/pengiriman/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({ message: "Gagal menghapus pengiriman" }));
      if (!res.ok) throw new Error(result.message || "Gagal menghapus pengiriman");
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menghapus pengiriman");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredKirim = useMemo(() => {
    const q = kirimSearch.trim().toLowerCase();
    return kirim.filter((p) => {
      if (kirimStatus && p.status !== kirimStatus) return false;
      if (q && !`${p.noPengiriman} ${p.pesananNo} ${p.supplier}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [kirim, kirimStatus, kirimSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pembelian</h1>
          <p className="mt-1 text-sm text-slate-400">
            Faktur, pengiriman, pesanan, penawaran, dan permintaan pembelian PT Bumi Surya Farm
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled title="Segera hadir" className="cursor-not-allowed">
            <Upload className="h-4 w-4" /> Impor
          </Button>
          <BuatPembelianDropdown />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          label="Faktur Belum Dibayar"
          value={summary.belumDibayar}
          note={`${summary.belumDibayarCount} faktur terbuka`}
          tone="amber"
          Icon={FileText}
        />
        <SummaryCard
          label="Faktur Telat Dibayar"
          value={summary.telatDibayar}
          note={`${summary.telatDibayarCount} lewat jatuh tempo`}
          tone="red"
          Icon={Clock}
        />
        <SummaryCard
          label="Pelunasan 30 Hari Terakhir"
          value={summary.pelunasan30Hari}
          note={`${summary.pelunasan30Count} pelunasan 30 hari terakhir`}
          tone="green"
          Icon={TrendingUp}
        />
      </div>

      <div className="inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 text-xs font-medium">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 transition-colors ${
              tab === t.key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "faktur" && (
        <Card className="border-slate-200">
          <CardContent className="p-0">
            <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-56" aria-label="Filter status">
                {STATUS_FILTER_FAKTUR.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari no. faktur atau nama supplier..."
                  className="pl-9 pr-9"
                  aria-label="Cari no. faktur atau nama supplier"
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
                  <TableRow className="bg-slate-50">
                    <TableHead>Tanggal</TableHead>
                    <TableHead>No. Faktur</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Tanggal Jatuh Tempo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sisa Utang</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <PackageSearch className="h-5 w-5" />
                          </span>
                          <p className="text-sm font-medium text-slate-500">
                            {faktur.length === 0 ? "Belum ada faktur pembelian" : "Tidak ada faktur yang cocok dengan filter"}
                          </p>
                        </div>
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
                              onClick={() => openDetail(r)}
                              className="text-left text-xs font-medium text-slate-700 underline decoration-dotted hover:text-slate-900"
                              title={r.noFaktur}
                            >
                              {r.noFaktur}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">{r.supplier}</TableCell>
                          <TableCell className="text-xs text-slate-500">{formatDate(r.jatuhTempo)}</TableCell>
                          <TableCell>
                            <Badge variant={st.variant} className="text-[11px]">
                              {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium tracking-tight">
                            Rp {formatRupiah(r.sisa)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-slate-500">
                            Rp {formatRupiah(r.total)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Link
                                href={`/keuangan/pembelian/faktur/${r.id}/ubah`}
                                title="Ubah faktur"
                                aria-label={`Ubah ${r.noFaktur}`}
                                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 w-7 rounded-full")}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 w-7 rounded-full"
                                title="Hapus faktur"
                                aria-label={`Hapus ${r.noFaktur}`}
                                disabled={deletingId === r.id}
                                onClick={() => hapusFaktur(r)}
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
            <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-400">
              {filtered.length} dari {faktur.length} faktur
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Faktur — popup seperti Detail Penagihan di Penjualan */}
      <Dialog open={Boolean(detailRow)} onOpenChange={(v) => { if (!v) { setDetailRow(null); setDetailData(null); setPaymentTargetId(null); } }}>
        <DialogContent onClose={() => { setDetailRow(null); setDetailData(null); setPaymentTargetId(null); }} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Faktur</DialogTitle>
            <DialogDescription>
              {detailRow ? `${detailRow.noFaktur} — ${detailRow.supplier}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">Memuat detail...</p>
          ) : detailData ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Faktur</div>
                  <div className="font-medium truncate max-w-full">{detailData.noFaktur || detailData.id}</div>
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
                    <Badge variant={detailData.tagihan?.status === "LUNAS" ? "sehat" : detailData.tagihan?.status === "LUNAS_SEBAGIAN" ? "info" : "warning"} className="text-[11px]">
                      {detailData.tagihan?.status === "LUNAS" ? "Dibayar" : detailData.tagihan?.status === "LUNAS_SEBAGIAN" ? "Dibayar Sebagian" : "Menunggu Pembayaran"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Total</div>
                  <div className="font-medium">Rp {formatRupiah(detailData.total)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Sisa</div>
                  <div className="font-medium">Rp {formatRupiah(detailData.tagihan?.sisa ?? detailData.total)}</div>
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
                    <p className="px-3 py-6 text-center text-slate-400">Tidak ada rincian produk</p>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600">Riwayat Pembayaran</div>
                <div className="max-h-48 overflow-auto rounded-lg border border-slate-100">
                  {detailData.tagihan?.pembayaran?.length ? (
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
                        {detailData.tagihan.pembayaran.map((p: any) => (
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
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setDetailRow(null); setDetailData(null); setPaymentTargetId(null); }}>Tutup</Button>
                {detailRow && (
                  <Link href={`/keuangan/pembelian/faktur/${detailRow.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                    Lihat halaman
                  </Link>
                )}
                {detailData.tagihan && detailData.tagihan.status !== "LUNAS" && Number(detailData.tagihan.sisa) > 0 && (
                  <Button onClick={() => { setPaymentForm({ jumlahBayar: "", sumberDana: "KAS", tanggal: todayInputLocal(), keterangan: "" }); setPaymentError(""); setPaymentOpen(true); }}>Bayar Utang</Button>
                )}
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">Gagal memuat detail</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Form Pembayaran Utang */}
      <Dialog open={paymentOpen} onOpenChange={(v) => { if (!v) setPaymentOpen(false); }}>
        <DialogContent onClose={() => setPaymentOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bayar Utang</DialogTitle>
            <DialogDescription>{paymentTargetLabel}</DialogDescription>
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
              <Button type="submit" disabled={paymentSaving}>{paymentSaving ? "Menyimpan..." : "Buat Pembayaran"}</Button>
            </div>
          </form>
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
                  placeholder="Cari no. penerimaan atau nama supplier..."
                  className="pl-9 pr-9"
                  aria-label="Cari no. penerimaan atau nama supplier"
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
            {actionError && (
              <div className="border-b border-slate-100 px-4 py-2.5 text-xs text-red-600">{actionError}</div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>No. Penerimaan</TableHead>
                    <TableHead>No. Pesanan Asal</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Item</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKirim.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                        {kirim.length === 0 ? "Belum ada penerimaan barang" : "Tidak ada penerimaan yang cocok dengan filter"}
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
                        <TableCell className="text-sm text-slate-700">{p.supplier}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "SELESAI" ? "sehat" : "gray"} className="text-[11px]">
                            {p.status === "SELESAI" ? "Selesai" : "Belum Ditagih"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">{p.jumlahItem} baris</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 rounded-full"
                              title="Lihat detail penerimaan"
                              aria-label={`Detail ${p.noPengiriman}`}
                              onClick={() => openKirimDetail(p)}
                            >
                              <Search className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 w-7 rounded-full"
                              title="Hapus penerimaan"
                              aria-label={`Hapus ${p.noPengiriman}`}
                              disabled={deletingId === p.id}
                              onClick={() => hapusKirim(p)}
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
              {filteredKirim.length} dari {kirim.length} penerimaan · Penerimaan tidak memengaruhi Kas/Utang
            </div>
          </CardContent>
        </Card>
      )}
      {tab === "pesanan" && (
        <DokumenBeliTable
          rows={docs.filter((d) => d.tipe === "PESANAN")}
          tempoLabel="Target / Jatuh Tempo"
          noLabel="No. Pesanan"
          pihakLabel="Supplier"
          emptyText="Belum ada pesanan pembelian"
          deletingId={deletingId}
          onDelete={hapusDokumenRow}
          onOpenDetail={openDokDetail}
        />
      )}
      {tab === "penawaran" && (
        <DokumenBeliTable
          rows={docs.filter((d) => d.tipe === "PENAWARAN")}
          tempoLabel="Tanggal Kedaluwarsa"
          noLabel="No. Penawaran"
          pihakLabel="Supplier"
          emptyText="Belum ada penawaran pembelian"
          deletingId={deletingId}
          onDelete={hapusDokumenRow}
          onOpenDetail={openDokDetail}
        />
      )}
      {tab === "permintaan" && (
        <DokumenBeliTable
          rows={docs.filter((d) => d.tipe === "PERMINTAAN")}
          tempoLabel="Tanggal Dibutuhkan"
          noLabel="No. Permintaan"
          pihakLabel="Departemen"
          emptyText="Belum ada permintaan pembelian"
          deletingId={deletingId}
          onDelete={hapusDokumenRow}
          onOpenDetail={openDokDetail}
        />
      )}
      {tab === "tukar-faktur" && <EmptyTabTable key={tab} tabKey={tab} />}

      {/* Detail Dokumen Pembelian — popup seperti Detail Penagihan */}
      <Dialog open={Boolean(dokDetailRow)} onOpenChange={(v) => { if (!v) { setDokDetailRow(null); setDokDetailData(null); setDokError(""); } }}>
        <DialogContent onClose={() => { setDokDetailRow(null); setDokDetailData(null); setDokError(""); }} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dokDetailRow?.tipe === "PENAWARAN" ? "Detail Penawaran" : dokDetailRow?.tipe === "PESANAN" ? "Detail Pesanan" : "Detail Permintaan"}
            </DialogTitle>
            <DialogDescription>
              {dokDetailRow ? `${dokDetailRow.noDokumen} — ${dokDetailRow.pihak}` : ""}
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
                    <Badge variant={dokDetailData.status === "SELESAI" ? "sehat" : "gray"} className="text-[11px]">
                      {dokDetailData.status === "SELESAI" ? "Selesai" : "Belum Ditagih"}
                    </Badge>
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
              {(dokDetailData.sumber?.length > 0 || dokDetailData.turunan?.length > 0 || dokDetailData.pengiriman?.length > 0 || dokDetailData.faktur?.length > 0) && (
                <div className="grid gap-2 text-xs">
                  {dokDetailData.sumber?.length > 0 && (
                    <p className="text-slate-500">Asal: {dokDetailData.sumber.map((s: any) => s.noDokumen).join(", ")}</p>
                  )}
                  {dokDetailData.turunan?.length > 0 && (
                    <p className="text-slate-500">Turunan: {dokDetailData.turunan.map((t: any) => t.noDokumen).join(", ")}</p>
                  )}
                  {dokDetailData.pengiriman?.length > 0 && (
                    <p className="text-slate-500">Penerimaan: {dokDetailData.pengiriman.map((p: any) => p.noPengiriman).join(", ")}</p>
                  )}
                  {dokDetailData.faktur?.length > 0 && (
                    <p className="text-slate-500">Faktur: {dokDetailData.faktur.map((f: any) => f.noFaktur).join(", ")}</p>
                  )}
                </div>
              )}
              {dokError && <p className="text-sm text-red-600">{dokError}</p>}
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setDokDetailRow(null); setDokDetailData(null); setDokError(""); }} disabled={dokBusy}>Tutup</Button>
                {dokDetailRow && (
                  <Link href={`/keuangan/pembelian/dokumen/${SLUG_DOK_BELI[dokDetailRow.tipe]}/${dokDetailRow.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                    Lihat halaman
                  </Link>
                )}
                {dokDetailRow?.tipe === "PERMINTAAN" && (
                  <Link href={`/keuangan/pembelian/penawaran/baru?dari=${dokDetailRow.id}`} className={cn(buttonVariants({}))}>
                    Buat Penawaran
                  </Link>
                )}
                {dokDetailRow?.tipe === "PENAWARAN" && (
                  <Link href={`/keuangan/pembelian/pemesanan/baru?dari=${dokDetailRow.id}`} className={cn(buttonVariants({}))}>
                    Buat Pesanan
                  </Link>
                )}
                {dokDetailRow?.tipe === "PESANAN" && (
                  <>
                    <Link href={`/keuangan/pembelian/pengiriman/baru?pesananId=${dokDetailRow.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                      Buat Penerimaan
                    </Link>
                    <Link href={`/keuangan/pembelian/faktur/baru?dariPesanan=${dokDetailRow.id}`} className={cn(buttonVariants({}))}>
                      Buat Faktur
                    </Link>
                  </>
                )}
                <Button variant="outline" onClick={toggleDok} disabled={dokBusy}>
                  {(dokDetailData?.status ?? dokDetailRow?.status) === "SELESAI" ? "Buka Kembali" : "Tutup"}
                </Button>
                <Button variant="destructive" onClick={hapusDokumen} disabled={dokBusy}>Hapus</Button>
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">Gagal memuat detail</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Penerimaan — popup tanpa pembayaran */}
      <Dialog open={Boolean(kirimDetailRow)} onOpenChange={(v) => { if (!v) { setKirimDetailRow(null); setKirimDetailData(null); } }}>
        <DialogContent onClose={() => { setKirimDetailRow(null); setKirimDetailData(null); }} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Penerimaan</DialogTitle>
            <DialogDescription>
              {kirimDetailRow ? `${kirimDetailRow.noPengiriman} — ${kirimDetailRow.supplier}` : ""}
            </DialogDescription>
          </DialogHeader>
          {kirimDetailLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">Memuat detail...</p>
          ) : kirimDetailData ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Tgl. Penerimaan</div>
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
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">No. Referensi Supplier</div>
                  <div>{kirimDetailData.noRefSupplier || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Gudang</div>
                  <div>{kirimDetailData.gudang || "—"}</div>
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
                  Penerimaan tidak mencatat utang — utang baru terbentuk saat Faktur dibuat.
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setKirimDetailRow(null); setKirimDetailData(null); }}>Tutup</Button>
                {kirimDetailRow && (
                  <Link href={`/keuangan/pembelian/pengiriman/${kirimDetailRow.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                    Lihat halaman
                  </Link>
                )}
                {kirimDetailRow && (
                  <Link href={`/keuangan/pembelian/faktur/baru?dariPengiriman=${kirimDetailRow.id}`} className={cn(buttonVariants({}))}>
                    Buat Faktur
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">Gagal memuat detail</p>
          )}
        </DialogContent>
      </Dialog>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
        <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Alur: Permintaan → Penawaran → Pesanan Pembelian → Pengiriman (Penerimaan) → Faktur Pembelian → Utang → Pembayaran (Hutang & Piutang) → Kas & Bank → COA.
        Faktur dapat dibuat langsung tanpa melalui pesanan.
      </p>
    </div>
  );
}
