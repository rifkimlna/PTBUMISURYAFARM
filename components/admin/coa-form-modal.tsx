"use client";

import { useState, useEffect, FormEvent } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KELOMPOK_URUTAN, GOLOGAN_BY_KELOMPOK, type KelompokCOA, type AkunCOA } from "@/lib/coa";

interface CoaFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  editingAkun?: AkunCOA | null;
  loading?: boolean;
}

export function CoaFormModal({ open, onClose, onSubmit, editingAkun, loading }: CoaFormModalProps) {
  const [formData, setFormData] = useState({
    nama: "",
    kelompok: "Beban" as KelompokCOA,
    golongan: "",
    deskripsi: "",
  });
  const [error, setError] = useState("");

  // Reset form when modal opens/closes or editingAkun changes
  useEffect(() => {
    if (open) {
      if (editingAkun) {
        setFormData({
          nama: editingAkun.nama,
          kelompok: editingAkun.kelompok,
          golongan: editingAkun.golongan,
          deskripsi: editingAkun.deskripsi || "",
        });
      } else {
        setFormData({
          nama: "",
          kelompok: "Beban",
          golongan: "",
          deskripsi: "",
        });
      }
      setError("");
    }
  }, [open, editingAkun]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
    setError("");
  };

  const handleKelompokChange = (kelompok: KelompokCOA) => {
    setFormData((prev) => ({ ...prev, kelompok, golongan: "" }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!formData.nama.trim()) {
      setError("Nama akun wajib diisi");
      return;
    }
    if (!formData.golongan) {
      setError("Golongan wajib dipilih");
      return;
    }

    try {
      await onSubmit(new FormData(e.currentTarget));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan akun");
    }
  };

  const golonganOptions = GOLOGAN_BY_KELOMPOK[formData.kelompok] || [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex items-center justify-between p-4 border-b">
          <CardTitle className="text-lg">
            {editingAkun ? "Edit Akun COA" : "Tambah Akun COA"}
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="p-4 space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="nama" className="text-sm font-medium">Nama Akun <span className="text-red-500">*</span></Label>
              <Input
                id="nama"
                name="nama"
                value={formData.nama}
                onChange={handleChange}
                placeholder="Contoh: Beban Listrik"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Kelompok <span className="text-red-500">*</span></Label>
              <Select
                name="kelompok"
                value={formData.kelompok}
                onChange={(e) => handleKelompokChange(e.target.value as KelompokCOA)}
                disabled={loading || !!editingAkun}
              >
                {KELOMPOK_URUTAN.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="golongan" className="text-sm font-medium">Golongan <span className="text-red-500">*</span></Label>
              <Select
                id="golongan"
                name="golongan"
                value={formData.golongan}
                onChange={handleChange}
                disabled={loading || golonganOptions.length === 0}
              >
                <option value="">Pilih golongan</option>
                {golonganOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
              {golonganOptions.length === 0 && (
                <p className="text-xs text-slate-400">Pilih kelompok terlebih dahulu</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deskripsi" className="text-sm font-medium">Deskripsi (Opsional)</Label>
              <Textarea
                id="deskripsi"
                name="deskripsi"
                value={formData.deskripsi}
                onChange={handleChange}
                placeholder="Keterangan tambahan untuk akun ini"
                rows={3}
                disabled={loading}
              />
            </div>

            {editingAkun && (
              <p className="text-xs text-slate-400">
                Kode akun <strong>{editingAkun.kode}</strong> tidak bisa diubah.
                {editingAkun.tipe === "PEMASUKAN" && " (Tipe: Pemasukan)"}
                {editingAkun.tipe === "PENGELUARAN" && " (Tipe: Pengeluaran)"}
                {editingAkun.tipe === "NETRAL" && " (Tipe: Saldo)"}
              </p>
            )}
          </CardContent>

          <div className="flex justify-end gap-2 border-t p-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingAkun ? "Simpan Perubahan" : "Tambah Akun"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}