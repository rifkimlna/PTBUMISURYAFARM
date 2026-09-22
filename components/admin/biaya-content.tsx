"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalendarDays, Clock, FileText, PackageSearch, Plus, Search, Wallet, X } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

// Halaman Biaya PT BST (tahap UI, baca saja).
// Data gabungan pengeluaran tunai + utang yang sudah ada di database.
// Tanpa form buat, tanpa pembayaran, tanpa pajak, tanpa approval.

export type BiayaRow = {
  id: string;
  tanggal: string;
  nomor: string;
  kategori: string;
  penerima: string;
  status: "BELUM_LUNAS" | "LUNAS_SEBAGIAN" | "LUNAS";
  sisa: number;
  total: number;
  tags: string | null;
  sumber: "TUNAI" | "HUTANG";
  keterangan: string | null;
  sumberDana: string | null;
};

export type BiayaSummary = {
  bulanIni: number;
  bulanIniCount: number;
  tigaPuluhHari: number;
  tigaPuluhHariCount: number;
  belumDibayar: number;
  belumDibayarCount: number;
};

type TabKey = "biaya" | "persetujuan";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "biaya", label: "Biaya" },
  { key: "persetujuan", label: "Membutuhkan Persetujuan" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function displayStatus(status: BiayaRow["status"]): { label: string; variant: "sehat" | "info" | "warning" } {
  if (status === "LUNAS") return { label: "Dibayar", variant: "sehat" };
  if (status === "LUNAS_SEBAGIAN") return { label: "Dibayar Sebagian", variant: "info" };
  return { label: "Belum Dibayar", variant: "warning" };
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

export function BiayaContent({ summary, rows }: { summary: BiayaSummary; rows: BiayaRow[] }) {
  const [tab, setTab] = useState<TabKey>("biaya");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [detailRow, setDetailRow] = useState<BiayaRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (q && !`${r.nomor} ${r.kategori} ${r.penerima}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, status, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Biaya</h1>
          <p className="mt-1 text-sm text-slate-400">Pengeluaran PT Bumi Surya Farm</p>
        </div>
        <Button type="button" disabled title="Segera hadir" className="cursor-not-allowed">
          <Plus className="h-4 w-4" /> Buat Biaya Baru
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          label="Total Biaya Bulan Ini"
          value={summary.bulanIni}
          note={`${summary.bulanIniCount} transaksi bulan ini`}
          tone="amber"
          Icon={CalendarDays}
        />
        <SummaryCard
          label="Biaya 30 Hari Terakhir"
          value={summary.tigaPuluhHari}
          note={`${summary.tigaPuluhHariCount} transaksi 30 hari terakhir`}
          tone="red"
          Icon={Clock}
        />
        <SummaryCard
          label="Biaya Belum Dibayar"
          value={summary.belumDibayar}
          note={`${summary.belumDibayarCount} tagihan terbuka`}
          tone="green"
          Icon={Wallet}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Saldo ditampilkan untuk semua jangka waktu, kecuali dinyatakan lain.
      </p>

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

      {tab === "biaya" && (
        <Card className="border-slate-200">
          <CardContent className="p-0">
            <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-56" aria-label="Filter status">
                <option value="">Semua Status</option>
                <option value="BELUM_LUNAS">Belum Dibayar</option>
                <option value="LUNAS_SEBAGIAN">Dibayar Sebagian</option>
                <option value="LUNAS">Dibayar</option>
              </Select>
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nomor, kategori, atau penerima..."
                  className="pl-9 pr-9"
                  aria-label="Cari nomor, kategori, atau penerima"
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
                    <TableHead>Nomor</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Penerima</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sisa Tagihan</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <PackageSearch className="h-5 w-5" />
                          </span>
                          <p className="text-sm font-medium text-slate-500">
                            {rows.length === 0 ? "Belum ada transaksi biaya." : "Tidak ada biaya yang cocok dengan filter"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => {
                      const st = displayStatus(r.status);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs text-slate-500">{formatDate(r.tanggal)}</TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => setDetailRow(r)}
                              className="text-left text-xs font-medium text-slate-700 underline decoration-dotted hover:text-slate-900"
                              title={r.nomor}
                            >
                              {r.nomor}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">{r.kategori}</TableCell>
                          <TableCell className="text-sm text-slate-700">{r.penerima}</TableCell>
                          <TableCell>
                            <Badge variant={st.variant} className="text-[11px]">
                              {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium tracking-tight">
                            {r.sisa === 0 ? <span className="text-slate-300">—</span> : `Rp ${formatRupiah(r.sisa)}`}
                          </TableCell>
                          <TableCell className="text-right text-sm text-slate-500">
                            Rp {formatRupiah(r.total)}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">{r.tags ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 rounded-full"
                                title="Lihat detail biaya"
                                aria-label={`Detail ${r.nomor}`}
                                onClick={() => setDetailRow(r)}
                              >
                                <Search className="h-3.5 w-3.5" />
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
              {filtered.length} dari {rows.length} biaya
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "persetujuan" && (
        <Card className="border-slate-200">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nomor</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Penerima</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sisa Tagihan</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <FileText className="h-5 w-5" />
                        </span>
                        <p className="text-sm font-medium text-slate-500">Belum ada biaya yang membutuhkan persetujuan.</p>
                        <p className="text-xs text-slate-400">PT BST belum menggunakan proses approval biaya.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">0 dari 0 pengajuan</div>
          </CardContent>
        </Card>
      )}

      {/* Detail Biaya — baca saja, tanpa pembayaran */}
      <Dialog open={Boolean(detailRow)} onOpenChange={(v) => { if (!v) setDetailRow(null); }}>
        <DialogContent onClose={() => setDetailRow(null)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Biaya</DialogTitle>
            <DialogDescription>
              {detailRow ? `${detailRow.nomor} — ${detailRow.penerima}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detailRow && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Tanggal</div>
                  <div>{formatDate(detailRow.tanggal)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Kategori</div>
                  <div>{detailRow.kategori}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Status</div>
                  <div>
                    <Badge variant={displayStatus(detailRow.status).variant} className="text-[11px]">
                      {displayStatus(detailRow.status).label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Tags</div>
                  <div>{detailRow.tags ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Sisa Tagihan</div>
                  <div className="font-medium">
                    {detailRow.sisa === 0 ? "—" : `Rp ${formatRupiah(detailRow.sisa)}`}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Total</div>
                  <div className="font-medium">Rp {formatRupiah(detailRow.total)}</div>
                </div>
                {detailRow.sumberDana && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Dibayar Dari</div>
                    <div>{detailRow.sumberDana}</div>
                  </div>
                )}
                {detailRow.keterangan && (
                  <div className="col-span-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Keterangan</div>
                    <div className="text-slate-600">{detailRow.keterangan}</div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDetailRow(null)}>Tutup</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
