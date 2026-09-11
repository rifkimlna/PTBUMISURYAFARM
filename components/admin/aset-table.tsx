"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

export type AsetRow = {
  id: string;
  namaAset: string;
  jumlah: number;
  kondisi: string;
  nilaiAset: number;
};

type FormValues = {
  id: string;
  namaAset: string;
  jumlah: string;
  kondisi: string;
  nilaiAset: string;
};

const emptyForm: FormValues = {
  id: "",
  namaAset: "",
  jumlah: "1",
  kondisi: "Baik",
  nilaiAset: "",
};

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className || ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function AsetTable({ initialData, canDelete }: { initialData: AsetRow[]; canDelete: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<AsetRow[]>(initialData);
  const [totalNilai, setTotalNilai] = useState(() =>
    initialData.reduce((sum, row) => sum + Number(row.nilaiAset) * row.jumlah, 0)
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const updateForm = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setMessage("");
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (row: AsetRow) => {
    setEditingId(row.id);
    setForm({
      id: row.id,
      namaAset: row.namaAset,
      jumlah: String(row.jumlah),
      kondisi: row.kondisi,
      nilaiAset: String(row.nilaiAset),
    });
    setMessage("");
    setDialogOpen(true);
  };

  const refreshAset = async () => {
    const response = await fetch("/api/aset");
    const result = await response.json().catch(() => ({ success: false }));
    if (result.success) {
      setRows(result.data.data);
      setTotalNilai(result.data.totalNilai);
    }
    router.refresh();
  };

  const saveAset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      id: form.id.trim(),
      namaAset: form.namaAset.trim(),
      jumlah: Number(form.jumlah),
      kondisi: form.kondisi.trim(),
      nilaiAset: Number(form.nilaiAset),
    };

    try {
      const url = editingId ? `/api/aset/${encodeURIComponent(editingId)}` : "/api/aset";
      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({ message: "Gagal menyimpan aset" }));
      if (!response.ok) {
        const detail = (result as any).errors ? (result as any).errors.map((e: any) => `${e.path}: ${e.message}`).join(", ") : "";
        throw new Error(detail ? `${result.message} — ${detail}` : result.message || "Gagal menyimpan aset");
      }
      setDialogOpen(false);
      setMessage(editingId ? "Aset berhasil diperbarui" : "Aset berhasil ditambahkan");
      await refreshAset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan aset");
    } finally {
      setSaving(false);
    }
  };

  const deleteAset = async (row: AsetRow) => {
    if (!window.confirm(`Hapus aset ${row.id} - ${row.namaAset}?`)) return;
    setMessage("");
    try {
      const response = await fetch(`/api/aset/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({ message: "Gagal menghapus aset" }));
      if (!response.ok) throw new Error(result.message || "Gagal menghapus aset");
      setMessage("Aset berhasil dihapus");
      await refreshAset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus aset");
    }
  };

  return (
    <>
      <Card className="border-slate-200 overflow-hidden">
        <CardHeader className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-sm">Daftar Aset</CardTitle>
            <p className="mt-1 text-xs text-slate-500">{rows.length} item • Total Nilai <span className="font-semibold">Rp {totalNilai.toLocaleString("id-ID")}</span></p>
          </div>
          <Button size="sm" onClick={openCreate} className="w-full sm:w-auto cursor-pointer"><Plus className="h-3 w-3" /> Tambah Aset</Button>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile cards */}
          <div className="grid gap-3 p-3 sm:hidden">
            {rows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Belum ada aset</div> : rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="font-mono text-xs font-bold">{row.id}</div><div className="text-sm font-medium truncate">{row.namaAset}</div><div className="text-xs text-slate-500">Jumlah: {row.jumlah}</div></div>
                  <Badge variant="outline" className="text-xs shrink-0">{row.kondisi}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-400">Nilai</div><div className="font-medium">Rp {Number(row.nilaiAset).toLocaleString("id-ID")}</div></div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2"><div className="text-[11px] text-emerald-700">Total</div><div className="font-semibold text-emerald-900">Rp {(Number(row.nilaiAset)*row.jumlah).toLocaleString("id-ID")}</div></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 rounded-full h-9 cursor-pointer" onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  {canDelete && <Button variant="destructive" size="sm" className="flex-1 rounded-full h-9 cursor-pointer" onClick={() => deleteAset(row)}><Trash2 className="h-3.5 w-3.5" /> Hapus</Button>}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Kondisi</TableHead>
                  <TableHead>Nilai</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-500">Belum ada aset</TableCell></TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.id}</TableCell>
                      <TableCell className="text-sm font-medium">{row.namaAset}</TableCell>
                      <TableCell className="text-sm text-slate-500">{row.jumlah}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{row.kondisi}</Badge></TableCell>
                      <TableCell className="text-sm whitespace-nowrap">Rp {Number(row.nilaiAset).toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-sm font-medium whitespace-nowrap">Rp {(Number(row.nilaiAset) * row.jumlah).toLocaleString("id-ID")}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full cursor-pointer touch-manipulation" onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5" /></Button>
                          {canDelete && <Button variant="destructive" size="sm" className="h-8 w-8 rounded-full cursor-pointer touch-manipulation" onClick={() => deleteAset(row)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
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
            <DialogTitle>{editingId ? "Edit Aset" : "Tambah Aset"}</DialogTitle>
            <DialogDescription>Kelola inventaris aset PT Bumi Surya Farm.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveAset} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ID Aset">
                <Input
                  value={form.id}
                  disabled={Boolean(editingId)}
                  onChange={(event) => updateForm("id", event.target.value)}
                  placeholder="AST-001"
                  required
                />
              </Field>
              <Field label="Nama Aset">
                <Input
                  value={form.namaAset}
                  onChange={(event) => updateForm("namaAset", event.target.value)}
                  placeholder="Nama aset"
                  required
                />
              </Field>
              <Field label="Jumlah">
                <Input
                  type="number"
                  min="1"
                  value={form.jumlah}
                  onChange={(event) => updateForm("jumlah", event.target.value)}
                  required
                />
              </Field>
              <Field label="Kondisi">
                <Select value={form.kondisi} onChange={(event) => updateForm("kondisi", event.target.value)}>
                  <option value="Baik">Baik</option>
                  <option value="Rusak Ringan">Rusak Ringan</option>
                  <option value="Rusak Berat">Rusak Berat</option>
                </Select>
              </Field>
              <Field label="Nilai Aset (Rp)" className="sm:col-span-2">
                <Input
                  type="number"
                  min="1000"
                  step="1000"
                  value={form.nilaiAset}
                  onChange={(event) => updateForm("nilaiAset", event.target.value)}
                  placeholder="250000000"
                  required
                />
              </Field>
            </div>
            {message && <p className="text-sm text-red-600">{message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Aset"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}