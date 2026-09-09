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
import { Plus, FileSpreadsheet, Pencil, Trash2, Search } from "lucide-react";

type StatusKerja = "TETAP" | "KONTRAK" | "HARIAN";
type StatusGaji = "SUDAH_DIBAYAR" | "PENDING";
type JenisKelamin = "LAKI_LAKI" | "PEREMPUAN";

export type Row = {
  id: string;
  namaLengkap: string;
  jabatan: string;
  statusKerja: StatusKerja;
  gajiPokok: number;
  tanggalMasuk: string;
  telepon: string;
  email: string;
  alamat: string;
  tanggalLahir: string;
  jenisKelamin: JenisKelamin | "";
  divisi: string;
  lokasiKerja: string;
  bulanGaji: string;
  statusGaji: StatusGaji;
};

type FormValues = {
  id: string;
  namaLengkap: string;
  jabatan: string;
  statusKerja: StatusKerja;
  gajiPokok: string;
  tanggalMasuk: string;
  telepon: string;
  email: string;
  alamat: string;
  tanggalLahir: string;
  jenisKelamin: JenisKelamin | "";
  divisi: string;
  lokasiKerja: string;
};

const emptyForm: FormValues = {
  id: "",
  namaLengkap: "",
  jabatan: "",
  statusKerja: "TETAP",
  gajiPokok: "",
  tanggalMasuk: "",
  telepon: "",
  email: "",
  alamat: "",
  tanggalLahir: "",
  jenisKelamin: "",
  divisi: "",
  lokasiKerja: "",
};

function StatusBadge({ value, variant }: { value: string; variant: "sehat" | "perhatian" | "outline" | "secondary" }) {
  return <Badge variant={variant}>{value.replace("_", " ")}</Badge>;
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("id-ID");
}

function formatDateInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className || ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function KaryawanTable({ data }: { data: Row[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((row) =>
      [row.id, row.namaLengkap, row.jabatan, row.divisi, row.lokasiKerja, row.telepon, row.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [data, search]);

  const updateForm = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setDialogOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditingId(row.id);
    setForm({
      id: row.id,
      namaLengkap: row.namaLengkap,
      jabatan: row.jabatan,
      statusKerja: row.statusKerja,
      gajiPokok: String(row.gajiPokok),
      tanggalMasuk: formatDateInput(row.tanggalMasuk),
      telepon: row.telepon,
      email: row.email,
      alamat: row.alamat,
      tanggalLahir: formatDateInput(row.tanggalLahir),
      jenisKelamin: row.jenisKelamin,
      divisi: row.divisi,
      lokasiKerja: row.lokasiKerja,
    });
    setMessage("");
    setDialogOpen(true);
  };

  const saveKaryawan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      id: form.id,
      namaLengkap: form.namaLengkap.trim(),
      jabatan: form.jabatan.trim(),
      statusKerja: form.statusKerja,
      gajiPokok: Number(form.gajiPokok),
      tanggalMasuk: form.tanggalMasuk,
      telepon: form.telepon.trim() || undefined,
      email: form.email.trim() || undefined,
      alamat: form.alamat.trim() || undefined,
      tanggalLahir: form.tanggalLahir || undefined,
      jenisKelamin: form.jenisKelamin || undefined,
      divisi: form.divisi.trim() || undefined,
      lokasiKerja: form.lokasiKerja.trim() || undefined,
    };

    try {
      const url = editingId ? `/api/karyawan/${encodeURIComponent(editingId)}` : "/api/karyawan";
      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({ message: "Gagal menyimpan data karyawan" }));
      if (!response.ok) throw new Error(result.message || "Gagal menyimpan data karyawan");
      setDialogOpen(false);
      setMessage(editingId ? "Data karyawan berhasil diperbarui" : "Karyawan berhasil ditambahkan");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan data karyawan");
    } finally {
      setSaving(false);
    }
  };

  const deleteKaryawan = async (id: string, nama: string) => {
    if (!window.confirm(`Hapus karyawan ${nama}?`)) return;
    setMessage("");
    try {
      const response = await fetch(`/api/karyawan/${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({ message: "Gagal menghapus data karyawan" }));
      if (!response.ok) throw new Error(result.message || "Gagal menghapus data karyawan");
      setMessage("Karyawan berhasil dihapus");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus data karyawan");
    }
  };

  const exportCsv = () => {
    const header = [
      "ID",
      "Nama Lengkap",
      "Jabatan",
      "Divisi",
      "Lokasi Kerja",
      "Telepon",
      "Email",
      "Tanggal Lahir",
      "Jenis Kelamin",
      "Tanggal Masuk",
      "Gaji Pokok",
      "Bulan Gaji",
      "Status Gaji",
    ];
    const rows = filteredRows.map((row) => [
      row.id,
      row.namaLengkap,
      row.jabatan,
      row.divisi,
      row.lokasiKerja,
      row.telepon,
      row.email,
      formatDate(row.tanggalLahir),
      row.jenisKelamin.replace("_", " "),
      formatDate(row.tanggalMasuk),
      row.gajiPokok,
      row.bulanGaji,
      row.statusGaji,
    ]);
    const csv = [header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "data-karyawan-pt-bst.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card className="border-slate-200">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm">Manajemen Karyawan</CardTitle>
            <p className="mt-1 text-xs text-slate-500">{data.length} total • {filteredRows.length} ditampilkan</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Cari nama, ID, divisi..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <FileSpreadsheet className="h-3 w-3" /> Export Excel
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3 w-3" /> Tambah Karyawan
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead>Divisi</TableHead>
                  <TableHead>Lokasi Kerja</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tanggal Masuk</TableHead>
                  <TableHead>Gaji Pokok</TableHead>
                  <TableHead>Gaji Terakhir</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-slate-500">
                      {data.length === 0 ? "Belum ada karyawan" : "Data karyawan tidak ditemukan"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-mono text-xs">{k.id}</TableCell>
                      <TableCell className="text-sm font-medium">{k.namaLengkap}</TableCell>
                      <TableCell className="text-sm">{k.jabatan}</TableCell>
                      <TableCell className="text-sm">{k.divisi || "-"}</TableCell>
                      <TableCell className="text-sm">{k.lokasiKerja || "-"}</TableCell>
                      <TableCell className="text-sm">{k.telepon || "-"}</TableCell>
                      <TableCell className="text-sm">{k.email || "-"}</TableCell>
                      <TableCell className="text-sm">{formatDate(k.tanggalMasuk)}</TableCell>
                      <TableCell className="text-sm font-medium">Rp {k.gajiPokok.toLocaleString("id-ID")}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-500">{k.bulanGaji || "-"}</span>
                          <StatusBadge
                            value={k.statusGaji}
                            variant={k.statusGaji === "SUDAH_DIBAYAR" ? "sehat" : "perhatian"}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full" onClick={() => openEdit(k)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="destructive" size="sm" className="h-7 w-7 rounded-full" onClick={() => deleteKaryawan(k.id, k.namaLengkap)}>
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setMessage("");
      }}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Karyawan" : "Tambah Karyawan"}</DialogTitle>
            <DialogDescription>Isi data profil, kontak, dan penempatan kerja karyawan.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveKaryawan} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ID Karyawan">
                <Input value={form.id} disabled={Boolean(editingId)} onChange={(event) => updateForm("id", event.target.value)} placeholder="EMP-001" />
              </Field>
              <Field label="Nama Lengkap">
                <Input value={form.namaLengkap} onChange={(event) => updateForm("namaLengkap", event.target.value)} placeholder="Nama lengkap" />
              </Field>
              <Field label="Jabatan">
                <Input value={form.jabatan} onChange={(event) => updateForm("jabatan", event.target.value)} placeholder="Jabatan" />
              </Field>
              <Field label="Status Kerja">
                <Select value={form.statusKerja} onChange={(event) => updateForm("statusKerja", event.target.value as StatusKerja)}>
                  <option value="TETAP">TETAP</option>
                  <option value="KONTRAK">KONTRAK</option>
                  <option value="HARIAN">HARIAN</option>
                </Select>
              </Field>
              <Field label="Gaji Pokok">
                <Input type="number" min="100000" step="1000" value={form.gajiPokok} onChange={(event) => updateForm("gajiPokok", event.target.value)} placeholder="3500000" />
              </Field>
              <Field label="Tanggal Masuk">
                <Input type="date" value={form.tanggalMasuk} onChange={(event) => updateForm("tanggalMasuk", event.target.value)} />
              </Field>
              <Field label="Telepon">
                <Input value={form.telepon} onChange={(event) => updateForm("telepon", event.target.value)} placeholder="0812..." />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="nama@email.com" />
              </Field>
              <Field label="Tanggal Lahir" className="sm:col-span-1">
                <Input type="date" value={form.tanggalLahir} onChange={(event) => updateForm("tanggalLahir", event.target.value)} />
              </Field>
              <Field label="Jenis Kelamin">
                <Select value={form.jenisKelamin} onChange={(event) => updateForm("jenisKelamin", event.target.value as JenisKelamin)} placeholder="Pilih jenis kelamin">
                  <option value="LAKI_LAKI">Laki-laki</option>
                  <option value="PEREMPUAN">Perempuan</option>
                </Select>
              </Field>
              <Field label="Divisi" className="sm:col-span-1">
                <Input value={form.divisi} onChange={(event) => updateForm("divisi", event.target.value)} placeholder="Operasional Kebun" />
              </Field>
              <Field label="Lokasi Kerja">
                <Input value={form.lokasiKerja} onChange={(event) => updateForm("lokasiKerja", event.target.value)} placeholder="Blok A" />
              </Field>
              <Field label="Alamat" className="sm:col-span-2">
                <Textarea value={form.alamat} onChange={(event) => updateForm("alamat", event.target.value)} placeholder="Alamat karyawan" />
              </Field>
            </div>
            {message && <p className="text-sm text-red-600">{message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Karyawan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
