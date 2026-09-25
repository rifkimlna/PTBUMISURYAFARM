"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Paperclip, X } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { labelSumberDana, SUMBER_DANA_KEYS, STATIC_COA_PEMASUKAN, STATIC_COA_PENGELUARAN } from "@/lib/coa";

type SumberKey = (typeof SUMBER_DANA_KEYS)[number];

type PendingBukti = {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
};

function todayInput() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className || ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

// Ambil COA PT BST dari database (fallback ke data statis bila API tak bisa diakses).
function useCoaOptions(kelompok: "Pendapatan" | "Beban") {
  const fallback = (kelompok === "Pendapatan" ? STATIC_COA_PEMASUKAN : STATIC_COA_PENGELUARAN).map(
    (a) => ({ kode: a.kode, nama: a.nama })
  );
  const [options, setOptions] = useState(fallback);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/keuangan/coa?kelompok=${kelompok}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (cancelled || !result?.success || !Array.isArray(result.data)) return;
        const list = result.data
          .filter((a: { isActive?: boolean }) => a.isActive !== false)
          .map((a: { kode: string; nama: string }) => ({ kode: a.kode, nama: a.nama }));
        if (list.length > 0) setOptions(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [kelompok]);
  return options;
}

function LampiranUploader({
  value,
  onChange,
}: {
  value: PendingBukti[];
  onChange: (next: PendingBukti[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || uploading) return;
    setUploading(true);
    setErrors([]);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    try {
      const res = await fetch("/api/keuangan/bukti", { method: "POST", body: formData });
      const result = await res.json().catch(() => ({}));
      if (result.success) {
        const uploaded = (result.data?.items ?? []) as PendingBukti[];
        const failed = (result.data?.errors ?? []) as { fileName?: string; message?: string }[];
        if (uploaded.length > 0) onChange([...value, ...uploaded]);
        if (failed.length > 0) {
          setErrors(failed.map((e) => e.message || e.fileName || "File ditolak"));
        } else if (uploaded.length === 0) {
          setErrors(["Tidak ada file yang berhasil ditambahkan"]);
        }
      } else {
        setErrors([result.message || "Gagal upload lampiran"]);
      }
    } catch {
      setErrors(["Gagal upload lampiran"]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Lampiran</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          {uploading ? "Mengupload..." : "+ Tambah Lampiran"}
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {value.map((item, index) => (
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
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                title="Hapus dari daftar"
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {errors.length > 0 && (
        <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-600">
          <ul className="list-disc space-y-0.5 pl-4">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

async function postTransaksi(payload: Record<string, unknown>) {
  const res = await fetch("/api/keuangan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await res.json().catch(() => ({ message: "Gagal menyimpan transaksi" }));
  if (!res.ok) {
    const detail = Array.isArray((result as { errors?: { message: string }[] }).errors)
      ? (result as { errors: { message: string }[] }).errors.map((e) => e.message).join("; ")
      : null;
    throw new Error(detail || result.message || "Gagal menyimpan transaksi");
  }
  return result;
}

function FormShell({
  title,
  subtitle,
  error,
  saving,
  onSubmit,
  onCancel,
  children,
}: {
  title: string;
  subtitle: string;
  error: string;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit}>
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 sm:p-6">{children}</CardContent>
      </Card>
      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Transaksi"}
        </Button>
      </div>
    </form>
  );
}

function SumberSelect({
  value,
  onChange,
  exclude,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  exclude?: string;
  label: string;
}) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} required>
        {SUMBER_DANA_KEYS.filter((key) => key !== exclude).map((key) => (
          <option key={key} value={key}>
            {labelSumberDana(key)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

// ================= TRANSFER UANG =================
// Satu baris TRANSFER: saldo akun asal berkurang, akun tujuan bertambah.
// Bukan pemasukan/pengeluaran.
export function TransferForm() {
  const router = useRouter();
  const [dari, setDari] = useState<SumberKey>("KAS");
  const [ke, setKe] = useState<SumberKey>("BANK");
  const [jumlah, setJumlah] = useState("");
  const [tanggal, setTanggal] = useState(todayInput());
  const [noTransaksi, setNoTransaksi] = useState("");
  const [memo, setMemo] = useState("");
  const [lampiran, setLampiran] = useState<PendingBukti[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const gantiAkunAsal = (next: SumberKey) => {
    setDari(next);
    if (ke === next) {
      setKe(SUMBER_DANA_KEYS.find((k) => k !== next) ?? "KAS");
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (dari === ke) throw new Error("Akun tujuan harus berbeda dengan akun asal");
      const nilai = Number(jumlah);
      if (!Number.isFinite(nilai) || nilai < 1000) throw new Error("Jumlah minimal Rp 1.000");
      await postTransaksi({
        tipe: "TRANSFER",
        kategori: "Transfer Antar Kas/Bank",
        sumberDana: dari,
        sumberDanaTujuan: ke,
        jumlah: nilai,
        tanggal: tanggal || undefined,
        noTransaksi: noTransaksi.trim() || undefined,
        keterangan: memo.trim() || undefined,
        ...(lampiran.length > 0 ? { bukti: lampiran } : {}),
      });
      router.push("/keuangan/kas");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan transfer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormShell
      title="Transfer Uang"
      subtitle="Pindah dana antar Kas / Bank / Tabungan. Transfer bukan pemasukan maupun pengeluaran."
      error={error}
      saving={saving}
      onSubmit={submit}
      onCancel={() => router.push("/keuangan/kas")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SumberSelect value={dari} onChange={(v) => gantiAkunAsal(v as SumberKey)} label="Transfer Dari" />
        <SumberSelect value={ke} onChange={(v) => setKe(v as SumberKey)} exclude={dari} label="Setor Ke" />
        <Field label="Jumlah">
          <Input
            type="number"
            min="1000"
            step="1000"
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            placeholder="1000000"
            required
          />
          {jumlah && Number(jumlah) >= 1000 && (
            <span className="text-[11px] text-slate-400">Rp {formatRupiah(Number(jumlah))}</span>
          )}
        </Field>
        <Field label="Tanggal Transaksi">
          <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
        </Field>
        <Field label="No Transaksi">
          <Input
            value={noTransaksi}
            onChange={(e) => setNoTransaksi(e.target.value)}
            placeholder="Otomatis bila dikosongkan"
            maxLength={50}
          />
        </Field>
        <div className="sm:col-span-2">
          <LampiranUploader value={lampiran} onChange={setLampiran} />
        </div>
        <Field label="Memo" className="sm:col-span-2">
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Catatan transfer (opsional)" />
        </Field>
      </div>
    </FormShell>
  );
}

// ================= TERIMA UANG =================
export function TerimaForm() {
  const router = useRouter();
  const akunOptions = useCoaOptions("Pendapatan");
  const [setorKe, setSetorKe] = useState<SumberKey>("KAS");
  const [yangMembayar, setYangMembayar] = useState("");
  const [tanggal, setTanggal] = useState(todayInput());
  const [noTransaksi, setNoTransaksi] = useState("");
  const [tag, setTag] = useState("");
  const [akun, setAkun] = useState("Pendapatan Penjualan Hasil Kebun");
  const [deskripsi, setDeskripsi] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [memo, setMemo] = useState("");
  const [lampiran, setLampiran] = useState<PendingBukti[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Nilai akun efektif: pakai pilihan form bila masih ada di COA, sonst opsi pertama dari database.
  const akunEfektif = akunOptions.some((a) => a.nama === akun) ? akun : (akunOptions[0]?.nama ?? "");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const nilai = Number(jumlah);
      if (!Number.isFinite(nilai) || nilai < 1000) throw new Error("Jumlah minimal Rp 1.000");
      if (!akunEfektif) throw new Error("Akun sumber penerimaan wajib dipilih");
      await postTransaksi({
        tipe: "PEMASUKAN",
        kategori: akunEfektif,
        sumberDana: setorKe,
        jumlah: nilai,
        tanggal: tanggal || undefined,
        noTransaksi: noTransaksi.trim() || undefined,
        pihak: yangMembayar.trim() || undefined,
        tag: tag.trim() || undefined,
        deskripsi: deskripsi.trim() || undefined,
        keterangan: memo.trim() || undefined,
        ...(lampiran.length > 0 ? { bukti: lampiran } : {}),
      });
      router.push("/keuangan/kas");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan penerimaan");
    } finally {
      setSaving(false);
    }
  };

  const akunTerpilih = akunOptions.find((a) => a.nama === akunEfektif);

  return (
    <FormShell
      title="Terima Uang"
      subtitle="Catat uang masuk ke Kas / Bank / Tabungan PT Bumi Surya Farm."
      error={error}
      saving={saving}
      onSubmit={submit}
      onCancel={() => router.push("/keuangan/kas")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SumberSelect value={setorKe} onChange={(v) => setSetorKe(v as SumberKey)} label="Setor Ke" />
        <Field label="Yang Membayar (opsional)">
          <Input
            value={yangMembayar}
            onChange={(e) => setYangMembayar(e.target.value)}
            placeholder="Nama pembayar"
            maxLength={150}
          />
        </Field>
        <Field label="Tanggal Transaksi">
          <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
        </Field>
        <Field label="No Transaksi">
          <Input
            value={noTransaksi}
            onChange={(e) => setNoTransaksi(e.target.value)}
            placeholder="Otomatis bila dikosongkan"
            maxLength={50}
          />
        </Field>
        <Field label="Tag (opsional)" className="sm:col-span-2">
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="mis. Panen-Blok-A"
            maxLength={100}
          />
        </Field>
      </div>

      <div className="rounded-xl border border-slate-200">
        <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-500">
          Rincian Penerimaan
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_220px]">
          <Field label="Akun">
            <Select value={akunEfektif} onChange={(e) => setAkun(e.target.value)} required>
              {akunOptions.map((a) => (
                <option key={a.kode} value={a.nama}>
                  {a.kode} - {a.nama}
                </option>
              ))}
            </Select>
            {akunTerpilih && (
              <span className="text-[11px] text-slate-400">Kode akun: {akunTerpilih.kode}</span>
            )}
          </Field>
          <Field label="Deskripsi">
            <Input
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Keterangan rincian (opsional)"
              maxLength={1000}
            />
          </Field>
          <Field label="Jumlah">
            <Input
              type="number"
              min="1000"
              step="1000"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              placeholder="1000000"
              required
            />
            {jumlah && Number(jumlah) >= 1000 && (
              <span className="text-[11px] text-slate-400">Rp {formatRupiah(Number(jumlah))}</span>
            )}
          </Field>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Memo">
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Catatan transaksi (opsional)" />
        </Field>
        <LampiranUploader value={lampiran} onChange={setLampiran} />
      </div>
    </FormShell>
  );
}

// ================= KIRIM UANG =================
export function KirimForm() {
  const router = useRouter();
  const akunOptions = useCoaOptions("Beban");
  const [bayarDari, setBayarDari] = useState<SumberKey>("KAS");
  const [penerima, setPenerima] = useState("");
  const [tanggal, setTanggal] = useState(todayInput());
  const [noTransaksi, setNoTransaksi] = useState("");
  const [tag, setTag] = useState("");
  const [akun, setAkun] = useState("Beban Upah dan Gaji Pekerja");
  const [deskripsi, setDeskripsi] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [memo, setMemo] = useState("");
  const [lampiran, setLampiran] = useState<PendingBukti[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Nilai akun efektif: pakai pilihan form bila masih ada di COA, sonst opsi pertama dari database.
  const akunEfektif = akunOptions.some((a) => a.nama === akun) ? akun : (akunOptions[0]?.nama ?? "");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const nilai = Number(jumlah);
      if (!Number.isFinite(nilai) || nilai < 1000) throw new Error("Jumlah minimal Rp 1.000");
      if (!akunEfektif) throw new Error("Akun tujuan pengeluaran wajib dipilih");
      await postTransaksi({
        tipe: "PENGELUARAN",
        kategori: akunEfektif,
        sumberDana: bayarDari,
        jumlah: nilai,
        tanggal: tanggal || undefined,
        noTransaksi: noTransaksi.trim() || undefined,
        pihak: penerima.trim() || undefined,
        tag: tag.trim() || undefined,
        deskripsi: deskripsi.trim() || undefined,
        keterangan: memo.trim() || undefined,
        ...(lampiran.length > 0 ? { bukti: lampiran } : {}),
      });
      router.push("/keuangan/kas");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengeluaran");
    } finally {
      setSaving(false);
    }
  };

  const akunTerpilih = akunOptions.find((a) => a.nama === akunEfektif);

  return (
    <FormShell
      title="Kirim Uang"
      subtitle="Catat uang keluar dari Kas / Bank / Tabungan PT Bumi Surya Farm."
      error={error}
      saving={saving}
      onSubmit={submit}
      onCancel={() => router.push("/keuangan/kas")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SumberSelect value={bayarDari} onChange={(v) => setBayarDari(v as SumberKey)} label="Bayar Dari" />
        <Field label="Penerima (opsional)">
          <Input
            value={penerima}
            onChange={(e) => setPenerima(e.target.value)}
            placeholder="Nama penerima"
            maxLength={150}
          />
        </Field>
        <Field label="Tanggal Transaksi">
          <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
        </Field>
        <Field label="No Transaksi">
          <Input
            value={noTransaksi}
            onChange={(e) => setNoTransaksi(e.target.value)}
            placeholder="Otomatis bila dikosongkan"
            maxLength={50}
          />
        </Field>
        <Field label="Tag (opsional)" className="sm:col-span-2">
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="mis. Operasional-September"
            maxLength={100}
          />
        </Field>
      </div>

      <div className="rounded-xl border border-slate-200">
        <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-500">
          Rincian Pengeluaran
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_220px]">
          <Field label="Akun">
            <Select value={akunEfektif} onChange={(e) => setAkun(e.target.value)} required>
              {akunOptions.map((a) => (
                <option key={a.kode} value={a.nama}>
                  {a.kode} - {a.nama}
                </option>
              ))}
            </Select>
            {akunTerpilih && (
              <span className="text-[11px] text-slate-400">Kode akun: {akunTerpilih.kode}</span>
            )}
          </Field>
          <Field label="Deskripsi">
            <Input
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Keterangan rincian (opsional)"
              maxLength={1000}
            />
          </Field>
          <Field label="Jumlah">
            <Input
              type="number"
              min="1000"
              step="1000"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              placeholder="1000000"
              required
            />
            {jumlah && Number(jumlah) >= 1000 && (
              <span className="text-[11px] text-slate-400">Rp {formatRupiah(Number(jumlah))}</span>
            )}
          </Field>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Memo">
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Catatan transaksi (opsional)" />
        </Field>
        <LampiranUploader value={lampiran} onChange={setLampiran} />
      </div>
    </FormShell>
  );
}
