"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export function PembelianContent({
  summary,
  faktur,
  initialTab,
}: {
  summary: PembelianSummary;
  faktur: FakturRow[];
  initialTab: TabKey;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

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
                            <Link
                              href={`/keuangan/pembelian/faktur/${r.id}`}
                              className="text-xs font-medium text-slate-700 underline decoration-dotted hover:text-slate-900"
                              title={r.noFaktur}
                            >
                              {r.noFaktur}
                            </Link>
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

      {tab !== "faktur" && <EmptyTabTable key={tab} tabKey={tab} />}

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
        <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Alur: Pesanan Pembelian → Pengiriman Pembelian → Faktur Pembelian → Utang → Pembayaran (Hutang & Piutang) → Kas & Bank → COA.
        Faktur dapat dibuat langsung tanpa melalui pesanan.
      </p>
    </div>
  );
}
