"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Paperclip, X, Loader2 } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { BuktiTransaksiDialog } from "@/components/admin/bukti-transaksi-dialog";

type Tipe = "PEMASUKAN" | "PENGELUARAN";

export type TransaksiRow = {
  id: string;
  tanggal: string;
  tipe: Tipe;
  kategori: string;
  jumlah: number;
  keterangan: string | null;
  admin: { nama: string };
  buktiCount?: number;
};

type PendingBukti = {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
};

type BuktiDialogTransaksi = { id: string; kategori: string; jumlah: number };

type FormValues = {
  tipe: Tipe;
  kategori: string;
  jumlah: string;
  keterangan: string;
  tanggal: string;
};

const emptyForm: FormValues = {
  tipe: "PEMASUKAN",
  kategori: "Penjualan Sawit",
  jumlah: "",
  keterangan: "",
  tanggal: "",
};

const kategoriList = [
  "Penjualan Sawit",
  "Penjualan Bibit",
  "Gaji Karyawan",
  "Pupuk",
  "Pestisida",
  "Perawatan Alat",
  "Bahan Bakar",
  "Pembelian Aset",
  "Operasional",
  "Lainnya",
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("id-ID");
}

function formatDateInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className || ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

type Summary = { pemasukan: number; pengeluaran: number; saldo: number };

export function TransaksiTable({
  initialData,
  initialTotal,
  canDelete,
  startDate,
  endDate,
  isFiltered,
  onSummaryChange,
  onDataChange,
}: {
  initialData: TransaksiRow[];
  initialTotal: number;
  canDelete: boolean;
  startDate?: string;
  endDate?: string;
  isFiltered?: boolean;
  onSummaryChange?: (summary: Summary) => void;
  onDataChange?: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<TransaksiRow[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [tipe, setTipe] = useState<"" | Tipe>("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [rowsVersion, setRowsVersion] = useState(0);
  const [pendingBukti, setPendingBukti] = useState<PendingBukti[]>([]);
  const [pendingBuktiErrors, setPendingBuktiErrors] = useState<string[]>([]);
  const [uploadingBukti, setUploadingBukti] = useState(false);
  const [buktiDialogTransaksi, setBuktiDialogTransaksi] = useState<BuktiDialogTransaksi | null>(null);
  const buktiInputRef = useRef<HTMLInputElement>(null);

  const bumpRows = useCallback(() => {
    setLoading(true);
    setRowsVersion((v) => v + 1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Jaga callback tetap stabil agar tidak memicu refetch
  const onSummaryChangeRef = useRef(onSummaryChange);
  useEffect(() => {
    onSummaryChangeRef.current = onSummaryChange;
  }, [onSummaryChange]);

  // Kembali ke halaman 1 ketika periode filter berubah
  const dateRange = `${startDate}|${endDate}`;
  const [prevDateRange, setPrevDateRange] = useState(dateRange);
  if (prevDateRange !== dateRange) {
    setPrevDateRange(dateRange);
    setPage(1);
  }

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (tipe) params.set("tipe", tipe);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    let cancelled = false;
    fetch(`/api/keuangan?${params.toString()}`)
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setRows(
            (result.data.data ?? []).map((row: TransaksiRow & { _count?: { bukti: number } }) => ({
              ...row,
              buktiCount: row._count?.bukti ?? row.buktiCount ?? 0,
            }))
          );
          setTotal(result.data.pagination.total);
          onSummaryChangeRef.current?.(result.data.summary);
        }
      })
      .catch(() => {
        if (!cancelled) setMessage("Gagal memuat transaksi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, limit, tipe, startDate, endDate, rowsVersion]);

  const goToPage = (next: number) => {
    setLoading(true);
    setPage(next);
  };

  const changeTipe = (next: "" | Tipe) => {
    setLoading(true);
    setPage(1);
    setTipe(next);
  };

  const updateForm = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setPendingBukti([]);
    setPendingBuktiErrors([]);
    setDialogOpen(true);
  };

  const openEdit = (row: TransaksiRow) => {
    setEditingId(row.id);
    setForm({
      tipe: row.tipe,
      kategori: row.kategori,
      jumlah: String(row.jumlah),
      keterangan: row.keterangan ?? "",
      tanggal: formatDateInput(row.tanggal),
    });
    setMessage("");
    setPendingBukti([]);
    setPendingBuktiErrors([]);
    setDialogOpen(true);
  };

  const handleBuktiFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || uploadingBukti) return;
    setUploadingBukti(true);
    setPendingBuktiErrors([]);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    try {
      const res = await fetch("/api/keuangan/bukti", { method: "POST", body: formData });
      const result = await res.json().catch(() => ({ message: "Gagal upload bukti" }));
      if (result.success) {
        const uploaded = (result.data?.items ?? []) as PendingBukti[];
        const failed = (result.data?.errors ?? []) as { fileName?: string; message?: string }[];
        if (uploaded.length > 0) {
          setPendingBukti((current) => [...current, ...uploaded]);
        }
        if (failed.length > 0) {
          setPendingBuktiErrors((current) => [
            ...current,
            ...failed.map((e) => e.message || e.fileName || "File ditolak"),
          ]);
        } else if (uploaded.length === 0) {
          setPendingBuktiErrors((current) => [...current, "Tidak ada file yang berhasil ditambahkan"]);
        }
      } else {
        setPendingBuktiErrors((current) => [...current, result.message || "Gagal upload bukti"]);
      }
    } catch {
      setPendingBuktiErrors((current) => [...current, "Gagal upload bukti"]);
    } finally {
      setUploadingBukti(false);
      if (buktiInputRef.current) buktiInputRef.current.value = "";
    }
  };

  const removePendingBukti = (index: number) => {
    setPendingBukti((current) => current.filter((_, i) => i !== index));
  };

  const saveTransaksi = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      tipe: form.tipe,
      kategori: form.kategori.trim(),
      jumlah: Number(form.jumlah),
      keterangan: form.keterangan.trim() || undefined,
      tanggal: form.tanggal || undefined,
      ...(pendingBukti.length > 0 ? { bukti: pendingBukti } : {}),
    };

    try {
      const url = editingId ? `/api/keuangan/${encodeURIComponent(editingId)}` : "/api/keuangan";
      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({ message: "Gagal menyimpan transaksi" }));
      if (!response.ok) throw new Error(result.message || "Gagal menyimpan transaksi");
      setDialogOpen(false);
      setMessage(editingId ? "Transaksi berhasil diperbarui" : "Transaksi berhasil ditambahkan");
      setLoading(true);
      setPage(1);
      setRowsVersion((v) => v + 1);
      onDataChange?.();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan transaksi");
    } finally {
      setSaving(false);
    }
  };

  const deleteTransaksi = async (row: TransaksiRow) => {
    if (!window.confirm(`Hapus transaksi ${row.kategori} Rp ${formatRupiah(row.jumlah)}?`)) return;
    setMessage("");
    try {
      const response = await fetch(`/api/keuangan/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({ message: "Gagal menghapus transaksi" }));
      if (!response.ok) throw new Error(result.message || "Gagal menghapus transaksi");
      setMessage("Transaksi berhasil dihapus");
      onDataChange?.();
      if (rows.length === 1 && page > 1) goToPage(page - 1);
      else {
        setLoading(true);
        setRowsVersion((v) => v + 1);
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus transaksi");
    }
  };

  return (
    <>
      <Card className="border-slate-200">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm">Transaksi Kas</CardTitle>
            <p className="mt-1 text-xs text-slate-500">{total} entri</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={tipe}
              onChange={(event) => changeTipe(event.target.value as "" | Tipe)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none focus:border-slate-300"
            >
              <option value="">Semua Tipe</option>
              <option value="PEMASUKAN">PEMASUKAN</option>
              <option value="PENGELUARAN">PENGELUARAN</option>
            </select>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3 w-3" /> Tambah Transaksi
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead className="text-center">Bukti</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                      {isFiltered ? "Tidak ada transaksi pada periode ini" : "Belum ada transaksi"}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs text-slate-500">{formatDate(row.tanggal)}</TableCell>
                      <TableCell>
                        <Badge variant={row.tipe === "PEMASUKAN" ? "sehat" : "outline"} className="text-[11px]">
                          {row.tipe}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">{row.kategori}</TableCell>
                      <TableCell className="text-sm font-medium tracking-tight">
                        Rp {formatRupiah(row.jumlah)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{row.admin.nama}</TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setBuktiDialogTransaksi({
                              id: row.id,
                              kategori: row.kategori,
                              jumlah: row.jumlah,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                          title="Lihat bukti transaksi"
                        >
                          {(row.buktiCount ?? 0) > 0 ? (
                            <>
                              <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                              <span className="font-medium">{row.buktiCount}</span>
                            </>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full" onClick={() => openEdit(row)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 w-7 rounded-full"
                              onClick={() => deleteTransaksi(row)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <span className="text-xs text-slate-400">
            Halaman {page} / {totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => goToPage(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => goToPage(page + 1)}>
              Berikutnya <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setMessage("");
        }}
      >
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Transaksi" : "Tambah Transaksi"}</DialogTitle>
            <DialogDescription>Catat pemasukan atau pengeluaran kas PT Bumi Surya Farm.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveTransaksi} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipe">
                <Select value={form.tipe} onChange={(event) => updateForm("tipe", event.target.value as Tipe)}>
                  <option value="PEMASUKAN">PEMASUKAN</option>
                  <option value="PENGELUARAN">PENGELUARAN</option>
                </Select>
              </Field>
              <Field label="Kategori">
                <Select value={form.kategori} onChange={(event) => updateForm("kategori", event.target.value)}>
                  {kategoriList.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Jumlah (Rp)">
                <Input
                  type="number"
                  min="1000"
                  step="1000"
                  value={form.jumlah}
                  onChange={(event) => updateForm("jumlah", event.target.value)}
                  placeholder="3500000"
                  required
                />
              </Field>
              <Field label="Tanggal">
                <Input type="date" value={form.tanggal} onChange={(event) => updateForm("tanggal", event.target.value)} />
              </Field>
              <Field label="Keterangan" className="sm:col-span-2">
                <Textarea value={form.keterangan} onChange={(event) => updateForm("keterangan", event.target.value)} placeholder="Opsional" />
              </Field>
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Bukti Transaksi (Opsional)</span>
                <input
                  ref={buktiInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(event) => handleBuktiFiles(event.target.files)}
                />
                {pendingBukti.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {pendingBukti.map((item, index) => (
                      <li
                        key={`${item.fileName}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{item.fileName}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 shrink-0 rounded-full p-0 text-slate-400 hover:text-red-600"
                          onClick={() => removePendingBukti(index)}
                          title="Hapus dari daftar"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {pendingBuktiErrors.length > 0 && (
                  <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-600">
                    <ul className="list-disc space-y-0.5 pl-4">
                      {pendingBuktiErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={uploadingBukti}
                  onClick={() => buktiInputRef.current?.click()}
                >
                  {uploadingBukti ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5" />
                  )}
                  {uploadingBukti ? "Mengupload..." : "+ Tambah Bukti"}
                </Button>
              </div>
            </div>
            {message && <p className="text-sm text-red-600">{message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Transaksi"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <BuktiTransaksiDialog
        open={Boolean(buktiDialogTransaksi)}
        transaksi={buktiDialogTransaksi}
        onOpenChange={(openNext) => {
          if (!openNext) setBuktiDialogTransaksi(null);
        }}
        onDataChange={() => {
          onDataChange?.();
          bumpRows();
        }}
      />
    </>
  );
}