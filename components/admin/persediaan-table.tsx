"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Search, History, PackagePlus, PackageMinus, Loader2 } from "lucide-react";
import { kategoriPersediaanList } from "@/lib/validations/persediaanValidation";
import { formatRupiah } from "@/lib/utils";

export type PersediaanStatus = "Tersedia" | "Stok Menipis" | "Habis";
export type PersediaanRow = {
  id: string;
  namaBarang: string;
  kategori: string;
  stokAwal: number;
  stok: number;
  satuan: string;
  hargaSatuan: number;
  totalNilai: number;
  keterangan: string | null;
  status: PersediaanStatus;
  createdAt: string;
};
export type PersediaanSummary = { totalJenis: number; totalStok: number; nilaiPersediaan: number };

type FormValues = {
  kode: string;
  namaBarang: string;
  kategori: string;
  stokAwal: string;
  satuan: string;
  hargaSatuan: string;
  keterangan: string;
};

const emptyForm: FormValues = {
  kode: "",
  namaBarang: "",
  kategori: kategoriPersediaanList[0],
  stokAwal: "0",
  satuan: "",
  hargaSatuan: "",
  keterangan: "",
};

type StokFormValues = {
  tanggal: string;
  jumlah: string;
  keterangan: string;
};

const emptyStokForm = (): StokFormValues => ({
  tanggal: new Date().toISOString().slice(0, 10),
  jumlah: "",
  keterangan: "",
});

type RiwayatRow = {
  id: string;
  jenis: "MASUK" | "KELUAR";
  jumlah: number;
  keterangan: string | null;
  tanggal: string;
};

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className || ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: PersediaanStatus }) {
  const variant: Record<PersediaanStatus, "success" | "warning" | "destructive"> = {
    Tersedia: "success",
    "Stok Menipis": "warning",
    Habis: "destructive",
  };
  return <Badge variant={variant[status]}>{status}</Badge>;
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="border-slate-100">
      <CardContent className="p-5">
        <div className="text-xs tracking-wide text-slate-400">{label}</div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
        <div className="mt-1 text-xs text-slate-400">{note}</div>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function PersediaanTable({
  initialData,
  initialSummary,
  canDelete,
}: {
  initialData: PersediaanRow[];
  initialSummary: PersediaanSummary;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<PersediaanRow[]>(initialData);
  const [summary, setSummary] = useState<PersediaanSummary>(initialSummary);
  const [search, setSearch] = useState("");
  const [filterKategori, setFilterKategori] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [stokDialog, setStokDialog] = useState<{ row: PersediaanRow; jenis: "MASUK" | "KELUAR" } | null>(null);
  const [stokForm, setStokForm] = useState<StokFormValues>(emptyStokForm());
  const [savingStok, setSavingStok] = useState(false);
  const [stokError, setStokError] = useState("");

  const [riwayatDialog, setRiwayatDialog] = useState<{ id: string; nama: string } | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatRow[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);

  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !row.id.toLowerCase().includes(q) && !row.namaBarang.toLowerCase().includes(q)) return false;
      if (filterKategori && row.kategori !== filterKategori) return false;
      if (filterStatus && row.status !== filterStatus) return false;
      return true;
    });
  }, [rows, search, filterKategori, filterStatus]);

  const updateForm = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setNotice(null);
    setDialogOpen(true);
  };

  const openEdit = (row: PersediaanRow) => {
    setEditingId(row.id);
    setForm({
      kode: row.id,
      namaBarang: row.namaBarang,
      kategori: row.kategori,
      stokAwal: String(row.stokAwal),
      satuan: row.satuan,
      hargaSatuan: String(row.hargaSatuan),
      keterangan: row.keterangan ?? "",
    });
    setNotice(null);
    setDialogOpen(true);
  };

  const refreshList = async () => {
    const response = await fetch("/api/persediaan");
    const result = await response.json().catch(() => ({ success: false }));
    if (result.success) {
      setRows(result.data.data);
      setSummary(result.data.summary);
    }
    router.refresh();
  };

  const saveBarang = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    const payload = {
      kode: form.kode.trim().toUpperCase(),
      namaBarang: form.namaBarang.trim(),
      kategori: form.kategori,
      stokAwal: Number(form.stokAwal) || 0,
      satuan: form.satuan.trim(),
      hargaSatuan: Number(form.hargaSatuan) || 0,
      keterangan: form.keterangan.trim() || null,
    };

    try {
      const url = editingId ? `/api/persediaan/${encodeURIComponent(editingId)}` : "/api/persediaan";
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { ...payload, kode: undefined, stokAwal: undefined } : payload;
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({ message: "Gagal menyimpan barang" }));
      if (!response.ok) {
        const detail = result.errors ? result.errors.map((e: { message: string }) => e.message).join(", ") : "";
        throw new Error(detail ? `${result.message} — ${detail}` : result.message || "Gagal menyimpan barang");
      }
      setDialogOpen(false);
      setNotice({ type: "success", text: editingId ? "Barang berhasil diperbarui" : "Barang berhasil ditambahkan" });
      await refreshList();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Gagal menyimpan barang" });
    } finally {
      setSaving(false);
    }
  };

  const deleteBarang = async (row: PersediaanRow) => {
    if (!window.confirm(`Hapus barang ${row.id} - ${row.namaBarang}? Riwayat stoknya ikut terhapus.`)) return;
    setNotice(null);
    try {
      const response = await fetch(`/api/persediaan/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({ message: "Gagal menghapus barang" }));
      if (!response.ok) throw new Error(result.message || "Gagal menghapus barang");
      setNotice({ type: "success", text: "Barang berhasil dihapus" });
      await refreshList();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Gagal menghapus barang" });
    }
  };

  const openStokDialog = (row: PersediaanRow, jenis: "MASUK" | "KELUAR") => {
    setStokDialog({ row, jenis });
    setStokForm(emptyStokForm());
    setStokError("");
  };

  const updateStokForm = (key: keyof StokFormValues, value: string) => {
    setStokForm((current) => ({ ...current, [key]: value }));
  };

  const saveStok = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stokDialog) return;
    setSavingStok(true);
    setStokError("");

    try {
      const response = await fetch(`/api/persediaan/${encodeURIComponent(stokDialog.row.id)}/riwayat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jenis: stokDialog.jenis,
          jumlah: Number(stokForm.jumlah),
          keterangan: stokForm.keterangan.trim() || null,
          tanggal: stokForm.tanggal,
        }),
      });
      const result = await response.json().catch(() => ({ message: "Gagal mencatat stok" }));
      if (!response.ok) {
        const detail = result.errors ? result.errors.map((e: { message: string }) => e.message).join(", ") : "";
        throw new Error(detail ? `${result.message} — ${detail}` : result.message || "Gagal mencatat stok");
      }
      setNotice({ type: "success", text: `Stok ${stokDialog.jenis === "MASUK" ? "masuk" : "keluar"} berhasil dicatat` });
      setStokDialog(null);
      await refreshList();
    } catch (error) {
      setStokError(error instanceof Error ? error.message : "Gagal mencatat stok");
    } finally {
      setSavingStok(false);
    }
  };

  const openRiwayat = async (row: PersediaanRow) => {
    setRiwayatDialog({ id: row.id, nama: row.namaBarang });
    setRiwayat([]);
    setLoadingRiwayat(true);
    try {
      const response = await fetch(`/api/persediaan/${encodeURIComponent(row.id)}`);
      const result = await response.json().catch(() => ({ success: false }));
      if (result.success) setRiwayat(result.data.riwayat);
    } finally {
      setLoadingRiwayat(false);
    }
  };

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total Jenis Barang" value={String(summary.totalJenis)} note="Jenis barang terdaftar" />
        <SummaryCard label="Total Stok" value={formatRupiah(summary.totalStok)} note="Stok seluruh barang" />
        <SummaryCard label="Nilai Persediaan" value={`Rp ${formatRupiah(summary.nilaiPersediaan)}`} note="Stok × harga satuan" />
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari nama / kode barang..."
                  className="h-9 w-full min-w-[220px] pl-9"
                />
              </div>
              <Select
                value={filterKategori}
                onChange={(event) => setFilterKategori(event.target.value)}
                className="h-9 w-full min-w-[180px]"
                placeholder="Semua Kategori"
              >
                {kategoriPersediaanList.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
              <Select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                className="h-9 w-full min-w-[160px]"
                placeholder="Semua Status"
              >
                <option value="Tersedia">Tersedia</option>
                <option value="Stok Menipis">Stok Menipis</option>
                <option value="Habis">Habis</option>
              </Select>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3 w-3" /> Tambah Barang
            </Button>
          </div>
          {notice && (
            <p className={`mt-3 text-sm ${notice.type === "success" ? "text-green-600" : "text-red-600"}`}>{notice.text}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead>Harga Satuan</TableHead>
                  <TableHead>Total Nilai</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                      {rows.length === 0 ? "Belum ada barang" : "Tidak ada barang yang sesuai filter"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.id}</TableCell>
                      <TableCell className="text-sm font-medium">{row.namaBarang}</TableCell>
                      <TableCell className="text-sm text-slate-500">{row.kategori}</TableCell>
                      <TableCell className="text-sm font-semibold">{row.stok}</TableCell>
                      <TableCell className="text-sm text-slate-500">{row.satuan}</TableCell>
                      <TableCell className="text-sm">Rp {formatRupiah(row.hargaSatuan)}</TableCell>
                      <TableCell className="text-sm font-medium">Rp {formatRupiah(row.totalNilai)}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full" title="Stok Masuk" onClick={() => openStokDialog(row, "MASUK")}>
                            <PackagePlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full" title="Stok Keluar" onClick={() => openStokDialog(row, "KELUAR")}>
                            <PackageMinus className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full" title="Riwayat Stok" onClick={() => openRiwayat(row)}>
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full" title="Edit" onClick={() => openEdit(row)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {canDelete && (
                            <Button variant="destructive" size="sm" className="h-7 w-7 rounded-full" title="Hapus" onClick={() => deleteBarang(row)}>
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
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setNotice(null);
        }}
      >
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Barang" : "Tambah Barang"}</DialogTitle>
            <DialogDescription>Kelola persediaan barang PT Bumi Surya Farm.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveBarang} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kode Barang">
                <Input
                  value={form.kode}
                  disabled={Boolean(editingId)}
                  onChange={(event) => updateForm("kode", event.target.value)}
                  placeholder="BRG-001"
                  required
                />
              </Field>
              <Field label="Nama Barang">
                <Input
                  value={form.namaBarang}
                  onChange={(event) => updateForm("namaBarang", event.target.value)}
                  placeholder="Pupuk NPK 15-15-15"
                  required
                />
              </Field>
              <Field label="Kategori">
                <Select value={form.kategori} onChange={(event) => updateForm("kategori", event.target.value)}>
                  {kategoriPersediaanList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Satuan">
                <Input
                  value={form.satuan}
                  onChange={(event) => updateForm("satuan", event.target.value)}
                  placeholder="kg, liter, pcs, karung"
                  required
                />
              </Field>
              <Field label="Stok Awal">
                <Input
                  type="number"
                  min="0"
                  value={form.stokAwal}
                  disabled={Boolean(editingId)}
                  onChange={(event) => updateForm("stokAwal", event.target.value)}
                  required
                />
              </Field>
              <Field label="Harga Satuan (Rp)">
                <Input
                  type="number"
                  min="0"
                  step="500"
                  value={form.hargaSatuan}
                  onChange={(event) => updateForm("hargaSatuan", event.target.value)}
                  placeholder="25000"
                  required
                />
              </Field>
              <Field label="Keterangan" className="sm:col-span-2">
                <Textarea
                  value={form.keterangan}
                  onChange={(event) => updateForm("keterangan", event.target.value)}
                  placeholder="Opsional"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Barang"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(stokDialog)}
        onOpenChange={(open) => {
          if (!open) setStokDialog(null);
        }}
      >
        <DialogContent onClose={() => setStokDialog(null)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {stokDialog?.jenis === "MASUK" ? "Stok Masuk" : "Stok Keluar"}
            </DialogTitle>
            <DialogDescription>
              {stokDialog ? `${stokDialog.row.id} - ${stokDialog.row.namaBarang} • stok saat ini ${stokDialog.row.stok} ${stokDialog.row.satuan}` : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveStok} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tanggal">
                <Input
                  type="date"
                  value={stokForm.tanggal}
                  onChange={(event) => updateStokForm("tanggal", event.target.value)}
                  required
                />
              </Field>
              <Field label="Jumlah">
                <Input
                  type="number"
                  min="1"
                  value={stokForm.jumlah}
                  onChange={(event) => updateStokForm("jumlah", event.target.value)}
                  placeholder="10"
                  required
                />
              </Field>
              <Field label="Keterangan" className="sm:col-span-2">
                <Textarea
                  value={stokForm.keterangan}
                  onChange={(event) => updateStokForm("keterangan", event.target.value)}
                  placeholder="Opsional"
                />
              </Field>
            </div>
            {stokError && <p className="text-sm text-red-600">{stokError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStokDialog(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={savingStok}>
                {savingStok ? "Menyimpan..." : stokDialog?.jenis === "MASUK" ? "+ Simpan Stok Masuk" : "− Simpan Stok Keluar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(riwayatDialog)}
        onOpenChange={(open) => {
          if (!open) setRiwayatDialog(null);
        }}
      >
        <DialogContent onClose={() => setRiwayatDialog(null)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Riwayat Stok</DialogTitle>
            <DialogDescription>{riwayatDialog ? `${riwayatDialog.id} - ${riwayatDialog.nama}` : ""}</DialogDescription>
          </DialogHeader>
          {loadingRiwayat ? (
            <div className="flex h-24 items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat...
            </div>
          ) : riwayat.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              Belum ada riwayat stok.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riwayat.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">{formatDate(r.tanggal)}</TableCell>
                      <TableCell>
                        <Badge variant={r.jenis === "MASUK" ? "success" : "destructive"}>{r.jenis}</Badge>
                      </TableCell>
                      <TableCell className={`text-sm font-semibold ${r.jenis === "MASUK" ? "text-green-600" : "text-red-600"}`}>
                        {r.jenis === "MASUK" ? "+" : "−"}
                        {r.jumlah}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{r.keterangan || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}