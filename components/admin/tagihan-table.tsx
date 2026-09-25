"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Search, AlertTriangle, Clock, Loader2 } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

export type TipeTagihan = "HUTANG" | "PIUTANG";
type StatusTagihan = "BELUM_LUNAS" | "LUNAS_SEBAGIAN" | "LUNAS";

export type PembayaranRow = {
  id: string;
  tipe: TipeTagihan;
  kategori: string;
  kodeAkun?: string | null;
  sumberDana: string;
  jumlah: number;
  keterangan: string | null;
  tanggal: string;
  adminNama: string;
};

export type TagihanRow = {
  id: string;
  tipe: TipeTagihan;
  pihak: string;
  keterangan: string | null;
  jumlah: number;
  sisa: number;
  tanggal: string;
  jatuhTempo: string | null;
  status: StatusTagihan;
  adminNama: string;
  pembayaran: PembayaranRow[];
};

export type TagihanSummary = {
  totalHutang: number;
  totalPiutang: number;
  jatuhTempoDekat: number;
};

const STATUS_LABEL: Record<StatusTagihan, string> = {
  BELUM_LUNAS: "Belum Lunas",
  LUNAS_SEBAGIAN: "Sebagian",
  LUNAS: "Lunas",
};

const STATUS_VARIANT: Record<StatusTagihan, "perhatian" | "warning" | "sehat"> = {
  BELUM_LUNAS: "perhatian",
  LUNAS_SEBAGIAN: "warning",
  LUNAS: "sehat",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(row: TagihanRow) {
  if (!row.jatuhTempo || row.status === "LUNAS") return false;
  const tempo = new Date(row.jatuhTempo);
  if (Number.isNaN(tempo.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return tempo < today;
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className || ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function TagihanTable({ data, summary, tab }: { data: TagihanRow[]; summary: TagihanSummary; tab: TipeTagihan }) {
  const router = useRouter();
  const isHutang = tab === "HUTANG";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bayarRow, setBayarRow] = useState<TagihanRow | null>(null);
  const [riwayatRow, setRiwayatRow] = useState<TagihanRow | null>(null);
  const [riwayatData, setRiwayatData] = useState<PembayaranRow[]>([]);
  const [riwayatLoading, setRiwayatLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({ pihak: "", jumlah: "", tanggal: "", jatuhTempo: "", keterangan: "" });
  const [bayar, setBayar] = useState({ jumlahBayar: "", sumberDana: "KAS", tanggal: "", keterangan: "" });

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((row) =>
      [row.pihak, row.keterangan ?? "", row.adminNama].some((v) => v.toLowerCase().includes(term))
    );
  }, [data, search]);

  const openCreate = () => {
    setForm({ pihak: "", jumlah: "", tanggal: "", jatuhTempo: "", keterangan: "" });
    setMessage("");
    setDialogOpen(true);
  };

  const openBayar = (row: TagihanRow) => {
    setBayarRow(row);
    setBayar({ jumlahBayar: String(Math.round(row.sisa)), sumberDana: "KAS", tanggal: "", keterangan: "" });
    setMessage("");
  };

  const saveTagihan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/tagihan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipe: tab,
          pihak: form.pihak.trim(),
          keterangan: form.keterangan.trim() || null,
          jumlah: Number(form.jumlah),
          tanggal: form.tanggal || undefined,
          jatuhTempo: form.jatuhTempo || null,
        }),
      });
      const result = await response.json().catch(() => ({ message: "Gagal menyimpan tagihan" }));
      if (!response.ok) throw new Error(result.message || "Gagal menyimpan tagihan");
      setDialogOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan tagihan");
    } finally {
      setSaving(false);
    }
  };

  const saveBayar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bayarRow) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/tagihan/${encodeURIComponent(bayarRow.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jumlahBayar: Number(bayar.jumlahBayar),
          sumberDana: bayar.sumberDana,
          tanggal: bayar.tanggal || undefined,
          keterangan: bayar.keterangan.trim() || null,
        }),
      });
      const result = await response.json().catch(() => ({ message: "Gagal mencatat pembayaran" }));
      if (!response.ok) throw new Error(result.message || "Gagal mencatat pembayaran");
      setBayarRow(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mencatat pembayaran");
    } finally {
      setSaving(false);
    }
  };

  const deleteTagihan = async (row: TagihanRow) => {
    if (!window.confirm(`Hapus tagihan ${row.pihak} Rp ${formatRupiah(row.jumlah)}?`)) return;
    setMessage("");
    try {
      const response = await fetch(`/api/tagihan/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({ message: "Gagal menghapus tagihan" }));
      if (!response.ok) throw new Error(result.message || "Gagal menghapus tagihan");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus tagihan");
    }
  };

  const fetchRiwayat = async (row: TagihanRow) => {
    setRiwayatRow(row);
    setRiwayatData([]);
    setRiwayatLoading(true);
    try {
      const response = await fetch(`/api/tagihan/${encodeURIComponent(row.id)}`);
      const result = await response.json().catch(() => ({ data: [] }));
      if (result.success) {
        setRiwayatData(result.data.pembayaran ?? []);
      }
    } catch {
      setRiwayatData([]);
    } finally {
      setRiwayatLoading(false);
    }
  };

  return (
    <>
      {/* Ringkasan */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-slate-100">
          <CardContent className="p-5">
            <div className="text-xs tracking-wide text-slate-400">Total Hutang Beredar</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-red-600">
              Rp {formatRupiah(summary.totalHutang)}
            </div>
            <div className="mt-1 text-xs text-slate-400">belum lunas</div>
          </CardContent>
        </Card>
        <Card className="border-slate-100">
          <CardContent className="p-5">
            <div className="text-xs tracking-wide text-slate-400">Total Piutang Beredar</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-green-700">
              Rp {formatRupiah(summary.totalPiutang)}
            </div>
            <div className="mt-1 text-xs text-slate-400">belum lunas</div>
          </CardContent>
        </Card>
        <Card className="border-slate-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs tracking-wide text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5" /> Jatuh Tempo ≤ 7 Hari
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{summary.jatuhTempoDekat}</div>
            <div className="mt-1 text-xs text-slate-400">tagihan belum lunas</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 overflow-hidden">
        <CardHeader className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-sm">{isHutang ? "Daftar Hutang" : "Daftar Piutang"}</CardTitle>
            <p className="mt-1 text-xs text-slate-500">{data.length} total • {filteredRows.length} ditampilkan</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9 w-full" placeholder="Cari pihak..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Button size="sm" onClick={openCreate} className="flex-1 sm:flex-none cursor-pointer">
              <Plus className="h-3 w-3" /> Tambah
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile cards */}
          <div className="grid gap-3 p-3 md:hidden">
            {filteredRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                {data.length === 0 ? `Belum ada ${isHutang ? "hutang" : "piutang"}` : "Data tidak ditemukan"}
              </div>
            ) : (
              filteredRows.map((t) => (
                <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{t.pihak}</div>
                      <div className="text-xs text-slate-500">{t.keterangan || "Tanpa keterangan"}</div>
                    </div>
                    <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Sisa</div><div className="font-semibold">Rp {formatRupiah(t.sisa)}</div></div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Jatuh Tempo</div><div className={`font-medium ${isOverdue(t) ? "text-red-600" : ""}`}>{formatDate(t.jatuhTempo)}</div></div>
                  </div>
<div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 sm:flex-none rounded-full h-9 cursor-pointer"
                        onClick={() => fetchRiwayat(t)}
                      >
                        <Clock className="h-3.5 w-3.5" /> Riwayat
                      </Button>
                      {t.status !== "LUNAS" && (
                      <Button size="sm" className="flex-1 rounded-full h-9 cursor-pointer" onClick={() => openBayar(t)}>
                        <Pencil className="h-3.5 w-3.5" /> {isHutang ? "Bayar" : "Terima"}
                      </Button>
                    )}
                    <Button variant="destructive" size="sm" className="flex-1 rounded-full h-9 cursor-pointer" onClick={() => deleteTagihan(t)}>
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[860px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pihak</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Sisa</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Riwayat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                        {data.length === 0 ? `Belum ada ${isHutang ? "hutang" : "piutang"}` : "Data tidak ditemukan"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm font-medium">{t.pihak}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate" title={t.keterangan ?? ""}>{t.keterangan || "-"}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">Rp {formatRupiah(t.jumlah)}</TableCell>
                        <TableCell className="text-sm font-semibold whitespace-nowrap">Rp {formatRupiah(t.sisa)}</TableCell>
                        <TableCell className={`text-sm whitespace-nowrap ${isOverdue(t) ? "text-red-600 font-medium" : ""}`}>
                          {formatDate(t.jatuhTempo)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full cursor-pointer"
                            onClick={() => fetchRiwayat(t)}
                          >
                            <Clock className="h-3.5 w-3.5" /> {t.pembayaran.length > 0 ? t.pembayaran.length : "0"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {t.status !== "LUNAS" && (
                              <Button size="sm" className="h-8 rounded-full cursor-pointer" onClick={() => openBayar(t)}>
                                {isHutang ? "Bayar" : "Terima"}
                              </Button>
                            )}
                            <Button variant="destructive" size="sm" className="h-8 w-8 rounded-full cursor-pointer touch-manipulation" onClick={() => deleteTagihan(t)}>
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
          </div>
        </CardContent>
      </Card>
      {message && <p className="text-sm text-red-600">{message}</p>}

      {/* Dialog tambah */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setMessage(""); }}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Tambah {isHutang ? "Hutang" : "Piutang"}</DialogTitle>
            <DialogDescription>Catat tagihan baru. Jatuh tempo boleh dikosongkan.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveTagihan} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={isHutang ? "Pemasok / Pihak" : "Pembeli / Pihak"} className="sm:col-span-2">
                <Input value={form.pihak} onChange={(e) => setForm({ ...form, pihak: e.target.value })} placeholder={isHutang ? "Nama supplier" : "Nama tengkulak"} />
              </Field>
              <Field label="Jumlah (Rp)">
                <Input type="number" min="1000" step="1000" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} placeholder="1000000" />
              </Field>
              <Field label="Tanggal">
                <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
              </Field>
              <Field label="Jatuh Tempo (opsional)" className="sm:col-span-2">
                <Input type="date" value={form.jatuhTempo} onChange={(e) => setForm({ ...form, jatuhTempo: e.target.value })} />
              </Field>
              <Field label="Keterangan (opsional)" className="sm:col-span-2">
                <Textarea value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Contoh: Pupuk NPK 10 sak" />
              </Field>
            </div>
            {message && <p className="text-sm text-red-600">{message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog pembayaran */}
      <Dialog open={bayarRow !== null} onOpenChange={(open) => { if (!open) { setBayarRow(null); setMessage(""); } }}>
        <DialogContent onClose={() => { setBayarRow(null); setMessage(""); }} className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{isHutang ? "Bayar Hutang" : "Terima Piutang"}</DialogTitle>
            <DialogDescription>
              {bayarRow && `${bayarRow.pihak} • Sisa Rp ${formatRupiah(bayarRow.sisa)}. Otomatis tercatat di Keuangan Kas.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveBayar} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nominal (Rp)">
                <Input type="number" min="1000" step="1000" value={bayar.jumlahBayar} onChange={(e) => setBayar({ ...bayar, jumlahBayar: e.target.value })} placeholder="500000" />
              </Field>
              <Field label="Sumber Dana">
                <Select value={bayar.sumberDana} onChange={(e) => setBayar({ ...bayar, sumberDana: e.target.value })}>
                  <option value="KAS">Kas</option>
                  <option value="BANK">Bank</option>
                  <option value="TABUNGAN">Tabungan</option>
                </Select>
              </Field>
              <Field label="Tanggal" className="sm:col-span-2">
                <Input type="date" value={bayar.tanggal} onChange={(e) => setBayar({ ...bayar, tanggal: e.target.value })} />
              </Field>
              <Field label="Keterangan (opsional)" className="sm:col-span-2">
                <Textarea value={bayar.keterangan} onChange={(e) => setBayar({ ...bayar, keterangan: e.target.value })} placeholder="Contoh: Cicilan pertama via transfer" />
              </Field>
            </div>
            {message && <p className="text-sm text-red-600">{message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setBayarRow(null); setMessage(""); }}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pembayaran"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog riwayat pembayaran */}
      <Dialog open={riwayatRow !== null} onOpenChange={(open) => { if (!open) { setRiwayatRow(null); setRiwayatData([]); setMessage(""); } }}>
        <DialogContent onClose={() => { setRiwayatRow(null); setRiwayatData([]); setMessage(""); }} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Riwayat Pembayaran</DialogTitle>
            <DialogDescription>
              {riwayatRow && `${riwayatRow.pihak} • Tagihan Rp ${formatRupiah(riwayatRow.jumlah)} • Sisa Rp ${formatRupiah(riwayatRow.sisa)}`}
            </DialogDescription>
          </DialogHeader>
          {riwayatLoading ? (
            <div className="flex h-24 items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat...
            </div>
          ) : riwayatData.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              Belum ada riwayat pembayaran.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Sumber Dana</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riwayatData.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">{formatDate(p.tanggal)}</TableCell>
                      <TableCell className="text-sm font-semibold text-green-600">Rp {formatRupiah(p.jumlah)}</TableCell>
                      <TableCell className="text-sm text-slate-500">{p.sumberDana}</TableCell>
                      <TableCell className="text-sm text-slate-500">{p.kodeAkun ? `${p.kodeAkun} - ` : ""}{p.kategori}</TableCell>
                      <TableCell className="text-sm text-slate-500">{p.adminNama}</TableCell>
                      <TableCell className="text-sm text-slate-500">{p.keterangan || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setRiwayatRow(null); setRiwayatData([]); setMessage(""); }}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
