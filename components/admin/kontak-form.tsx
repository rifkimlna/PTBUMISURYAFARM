"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type TipeKontak = "PELANGGAN" | "SUPPLIER" | "KARYAWAN";

export type StatusKerja = "TETAP" | "TIDAK_TETAP" | "PENDUKUNG";
export type JenisKelaminKontak = "LAKI_LAKI" | "PEREMPUAN";

export const STATUS_KERJA_LABEL: Record<StatusKerja, string> = {
  TETAP: "Tetap",
  TIDAK_TETAP: "Tidak Tetap",
  PENDUKUNG: "Pendukung",
};

export const TIPE_KONTAK_LABEL: Record<TipeKontak, string> = {
  PELANGGAN: "Pelanggan",
  SUPPLIER: "Supplier",
  KARYAWAN: "Karyawan",
};

export const TIPE_KONTAK_LIST: TipeKontak[] = ["PELANGGAN", "SUPPLIER", "KARYAWAN"];

export type KontakFormValues = {
  nama: string;
  tipe: TipeKontak;
  perusahaan: string;
  email: string;
  noHp: string;
  noTelepon: string;
  alamat: string;
  catatan: string;
  // Khusus Karyawan (hanya dipakai bila tipe = KARYAWAN)
  kodeKaryawan: string;
  jabatan: string;
  statusKerja: StatusKerja | "";
  lokasiKerja: string;
  tanggalMasuk: string;
  gajiPokok: string;
  tanggalLahir: string;
  jenisKelamin: JenisKelaminKontak | "";
};

export function emptyKontakForm(tipe: TipeKontak = "PELANGGAN"): KontakFormValues {
  return {
    nama: "",
    tipe,
    perusahaan: "",
    email: "",
    noHp: "",
    noTelepon: "",
    alamat: "",
    catatan: "",
    kodeKaryawan: "",
    jabatan: "",
    statusKerja: "",
    lokasiKerja: "",
    tanggalMasuk: "",
    gajiPokok: "",
    tanggalLahir: "",
    jenisKelamin: "",
  };
}

// Nilai ISO/date dari database -> value input type="date" (YYYY-MM-DD).
export function toDateInputValue(iso: string | Date | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className || ""}`}>
      <span className="text-xs font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

// Form kontak bersama untuk dialog Buat dan Edit. Hanya Nama + Tipe yang wajib.
export function KontakFormFields({
  form,
  setForm,
}: {
  form: KontakFormValues;
  setForm: (form: KontakFormValues) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nama kontak" required className="sm:col-span-2">
        <Input
          value={form.nama}
          onChange={(e) => setForm({ ...form, nama: e.target.value })}
          placeholder="Nama panggilan / nama kontak"
        />
      </Field>
      <Field label="Tipe kontak" required className="sm:col-span-2">
        <Select value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value as TipeKontak })}>
          {TIPE_KONTAK_LIST.map((t) => (
            <option key={t} value={t}>
              {TIPE_KONTAK_LABEL[t]}
            </option>
          ))}
          {/* Baris lama berkategori Lainnya (arsip): tetap bisa dibuka/diubah tipenya, tanpa ditawarkan sebagai pilihan baru. */}
          {(form.tipe as string) === "LAINNYA" && <option value="LAINNYA">Lainnya (lama)</option>}
        </Select>
      </Field>
      <Field label="Nama perusahaan" className="sm:col-span-2">
        <Input
          value={form.perusahaan}
          onChange={(e) => setForm({ ...form, perusahaan: e.target.value })}
          placeholder="PT / CV / nama usaha (opsional)"
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="nama@email.com"
        />
      </Field>
      <Field label="No. handphone">
        <Input
          value={form.noHp}
          onChange={(e) => setForm({ ...form, noHp: e.target.value })}
          placeholder="08xx (opsional)"
        />
      </Field>
      <Field label="No. telepon" className="sm:col-span-2">
        <Input
          value={form.noTelepon}
          onChange={(e) => setForm({ ...form, noTelepon: e.target.value })}
          placeholder="(opsional)"
        />
      </Field>
      <Field label="Alamat" className="sm:col-span-2">
        <Textarea
          value={form.alamat}
          onChange={(e) => setForm({ ...form, alamat: e.target.value })}
          placeholder="Alamat lengkap (opsional)"
        />
      </Field>
      <Field label="Catatan / info lainnya" className="sm:col-span-2">
        <Textarea
          value={form.catatan}
          onChange={(e) => setForm({ ...form, catatan: e.target.value })}
          placeholder="Catatan tambahan (opsional)"
        />
      </Field>

      {form.tipe === "KARYAWAN" && (
        <>
          <div className="sm:col-span-2 mt-2 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-700">Data Karyawan</p>
            <p className="mt-0.5 text-[11px] text-slate-400">ID otomatis (EMP-...) bila dikosongkan.</p>
          </div>
          <Field label="ID Karyawan">
            <Input
              value={form.kodeKaryawan}
              onChange={(e) => setForm({ ...form, kodeKaryawan: e.target.value.toUpperCase() })}
              placeholder="Otomatis, ex: EMP-002"
              maxLength={20}
            />
          </Field>
          <Field label="Jabatan">
            <Input
              value={form.jabatan}
              onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
              placeholder="Mandor / Operator / ..."
              maxLength={50}
            />
          </Field>
          <Field label="Status pekerja">
            <Select value={form.statusKerja} onChange={(e) => setForm({ ...form, statusKerja: e.target.value as KontakFormValues["statusKerja"] })}>
              <option value="">Pilih status</option>
              <option value="TETAP">Tetap</option>
              <option value="TIDAK_TETAP">Tidak Tetap</option>
              <option value="PENDUKUNG">Pendukung</option>
            </Select>
          </Field>
          <Field label="Lokasi kerja">
            <Input
              value={form.lokasiKerja}
              onChange={(e) => setForm({ ...form, lokasiKerja: e.target.value })}
              placeholder="Blok A"
              maxLength={100}
            />
          </Field>
          <Field label="Tanggal masuk">
            <Input
              type="date"
              value={form.tanggalMasuk}
              onChange={(e) => setForm({ ...form, tanggalMasuk: e.target.value })}
            />
          </Field>
          <Field label="Gaji pokok (Rp)">
            <Input
              type="number"
              min="0"
              step="1000"
              value={form.gajiPokok}
              onChange={(e) => setForm({ ...form, gajiPokok: e.target.value })}
              placeholder="3500000"
            />
          </Field>
          <Field label="Tanggal lahir">
            <Input
              type="date"
              value={form.tanggalLahir}
              onChange={(e) => setForm({ ...form, tanggalLahir: e.target.value })}
            />
          </Field>
          <Field label="Jenis kelamin">
            <Select value={form.jenisKelamin} onChange={(e) => setForm({ ...form, jenisKelamin: e.target.value as KontakFormValues["jenisKelamin"] })}>
              <option value="">Pilih jenis kelamin</option>
              <option value="LAKI_LAKI">Laki-laki</option>
              <option value="PEREMPUAN">Perempuan</option>
            </Select>
          </Field>
        </>
      )}
    </div>
  );
}

// Payload untuk API: string kosong dikirim sebagai null agar tersimpan rapi.
export function kontakPayload(form: KontakFormValues) {
  const emptyToNull = (v: string) => (v.trim() === "" ? null : v.trim());
  const isKaryawan = form.tipe === "KARYAWAN";
  return {
    nama: form.nama.trim(),
    tipe: form.tipe,
    perusahaan: emptyToNull(form.perusahaan),
    email: emptyToNull(form.email),
    noHp: emptyToNull(form.noHp),
    noTelepon: emptyToNull(form.noTelepon),
    alamat: emptyToNull(form.alamat),
    catatan: emptyToNull(form.catatan),
    // Field karyawan hanya dikirim untuk tipe Karyawan.
    ...(isKaryawan
      ? {
          kodeKaryawan: emptyToNull(form.kodeKaryawan)?.toUpperCase() ?? null,
          jabatan: emptyToNull(form.jabatan),
          statusKerja: form.statusKerja === "" ? null : form.statusKerja,
          lokasiKerja: emptyToNull(form.lokasiKerja),
          tanggalMasuk: emptyToNull(form.tanggalMasuk),
          gajiPokok: emptyToNull(form.gajiPokok),
          tanggalLahir: emptyToNull(form.tanggalLahir),
          jenisKelamin: form.jenisKelamin === "" ? null : form.jenisKelamin,
        }
      : {}),
  };
}
