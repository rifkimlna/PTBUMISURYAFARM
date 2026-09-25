"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import {
  emptyKontakForm,
  kontakPayload,
  KontakFormFields,
  toDateInputValue,
  type KontakFormValues,
} from "@/components/admin/kontak-form";

export type KontakDetail = KontakFormValues & { id: string };

// Bentuk ringkas dari server (Date/Decimal dinormalisasi) -> nilai form.
export function kontakDetailToForm(k: {
  nama: string;
  tipe: KontakFormValues["tipe"];
  perusahaan?: string | null;
  email?: string | null;
  noHp?: string | null;
  noTelepon?: string | null;
  alamat?: string | null;
  catatan?: string | null;
  kodeKaryawan?: string | null;
  jabatan?: string | null;
  statusKerja?: string | null;
  lokasiKerja?: string | null;
  tanggalMasuk?: string | null;
  gajiPokok?: number | string | null;
  tanggalLahir?: string | null;
  jenisKelamin?: string | null;
}): KontakFormValues {
  const gajiStr =
    k.gajiPokok == null || (typeof k.gajiPokok === "string" && k.gajiPokok.trim() === "")
      ? ""
      : String(k.gajiPokok);
  return {
    nama: k.nama,
    tipe: k.tipe,
    perusahaan: k.perusahaan ?? "",
    email: k.email ?? "",
    noHp: k.noHp ?? "",
    noTelepon: k.noTelepon ?? "",
    alamat: k.alamat ?? "",
    catatan: k.catatan ?? "",
    kodeKaryawan: k.kodeKaryawan ?? "",
    jabatan: k.jabatan ?? "",
    statusKerja: (k.statusKerja as KontakFormValues["statusKerja"]) ?? "",
    lokasiKerja: k.lokasiKerja ?? "",
    tanggalMasuk: toDateInputValue(k.tanggalMasuk ?? null),
    gajiPokok: gajiStr,
    tanggalLahir: toDateInputValue(k.tanggalLahir ?? null),
    jenisKelamin: (k.jenisKelamin as KontakFormValues["jenisKelamin"]) ?? "",
  };
}

// Tombol + dialog Edit Kontak untuk halaman detail.
export function EditKontakButton({ kontak }: { kontak: KontakDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<KontakFormValues>(emptyKontakForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const openEdit = () => {
    setForm(kontakDetailToForm(kontak));
    setMessage("");
    setOpen(true);
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/kontak/${encodeURIComponent(kontak.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kontakPayload(form)),
      });
      const result = await response.json().catch(() => ({ message: "Gagal menyimpan perubahan" }));
      if (!response.ok) {
        const detail = Array.isArray((result as { errors?: { message: string }[] }).errors)
          ? (result as { errors: { message: string }[] }).errors.map((x) => x.message).join("; ")
          : null;
        throw new Error(detail || result.message || "Gagal menyimpan perubahan");
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button type="button" onClick={openEdit} className="cursor-pointer">
        <Pencil className="h-4 w-4" /> Edit Kontak
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setMessage(""); }}>
        <DialogContent onClose={() => setOpen(false)} className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Kontak</DialogTitle>
            <DialogDescription>Perubahan tersimpan sebagai master data bersama.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="grid gap-4">
            <KontakFormFields form={form} setForm={setForm} />
            {message && <p className="text-sm text-red-600">{message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Perubahan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
