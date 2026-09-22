"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Paperclip, Plus, Trash2, X } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { jatuhTempoDari } from "@/lib/tempo";

type TipeDokumen = "PENAWARAN" | "PESANAN" | "PROFORMA" | "TUKAR_FAKTUR" | "PENAGIHAN";

type Pelanggan = { id: string; nama: string; email: string | null; telepon: string | null; alamat: string | null };
type Produk = { id: string; namaBarang: string; satuan: string; hargaSatuan: number };
type Lampiran = { fileName: string; fileUrl: string; fileType: string; fileSize: number };

export const SYARAT_OPTIONS = ["Tunai", "Tempo 7 hari", "Tempo 14 hari", "Tempo 30 hari"];

// Jenis penjualan → akun pendapatan otomatis (COA PT BST):
// HASIL_KEBUN → 4101, TERNAK → 4102, IKAN → 4103, LAINNYA → 4104.
export type JenisPenjualan = "HASIL_KEBUN" | "TERNAK" | "IKAN" | "LAINNYA";

const AKUN_PENDAPATAN_BY_JENIS: Record<JenisPenjualan, string> = {
  HASIL_KEBUN: "4101",
  TERNAK: "4102",
  IKAN: "4103",
  LAINNYA: "4104",
};

export function todayInput() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function toDateInputValue(iso: string | Date | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
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

function fieldError(result: { errors?: Array<{ message: string }> }, fallback: string) {
  const detail = Array.isArray(result.errors) ? result.errors.map((e) => e.message).join("; ") : null;
  return detail || (result as { message?: string }).message || fallback;
}

// ---------- Data pelanggan & produk dari database ----------
async function fetchPelanggan(): Promise<Pelanggan[]> {
  const res = await fetch("/api/pelanggan?limit=200", { credentials: "include" });
  const result = await res.json().catch(() => null);
  if (result?.success && Array.isArray(result.data)) return result.data as Pelanggan[];
  return [];
}

function usePelanggan() {
  const [list, setList] = useState<Pelanggan[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try {
      setList(await fetchPelanggan());
    } catch {
      // pelanggan wajib dari database; daftar kosong = wajib tambah dulu
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    fetchPelanggan()
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { list, loading, reload };
}

function useProduk() {
  const [list, setList] = useState<Produk[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/persediaan", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (cancelled) return;
        const arr = result?.success ? (result.data?.data ?? []) : [];
        if (Array.isArray(arr)) {
          setList(
            arr.map((b: { id: string; namaBarang: string; satuan: string; hargaSatuan: number }) => ({
              id: b.id,
              namaBarang: b.namaBarang,
              satuan: b.satuan,
              hargaSatuan: Number(b.hargaSatuan) || 0,
            }))
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return list;
}

// ---------- Dialog tambah pelanggan (sederhana, relevan PT BST) ----------
function TambahPelangganDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (p: Pelanggan) => void;
}) {
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [telepon, setTelepon] = useState("");
  const [alamat, setAlamat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pelanggan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: nama.trim(),
          email: email.trim() || undefined,
          telepon: telepon.trim() || undefined,
          alamat: alamat.trim() || undefined,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(fieldError(result, "Gagal tambah pelanggan"));
      onCreated(result.data as Pelanggan);
      setNama("");
      setEmail("");
      setTelepon("");
      setAlamat("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal tambah pelanggan");
    } finally {
      setSaving(false);
    }
  };

  // Portal ke body agar <form> dialog tidak nested di dalam <form> dokumen
  // (komponen Dialog project tidak memakai portal dan merender inline).
  // Aman: dialog hanya terbuka lewat interaksi pengguna (pasca-hydration).
  if (!open) return null;
  return createPortal(
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Pelanggan</DialogTitle>
          <DialogDescription>Kontak pelanggan PT Bumi Surya Farm.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Nama pelanggan *">
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama / usaha pelanggan" maxLength={100} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opsional" maxLength={100} />
            </Field>
            <Field label="Telepon">
              <Input value={telepon} onChange={(e) => setTelepon(e.target.value)} placeholder="opsional" maxLength={30} />
            </Field>
          </div>
          <Field label="Alamat">
            <Textarea value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="opsional" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Pelanggan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>,
    document.body
  );
}

// ---------- Pilih pelanggan ----------
function PelangganField({
  value,
  onSelect,
  disabled,
}: {
  value: string;
  onSelect: (id: string, p: Pelanggan | null) => void;
  disabled?: boolean;
}) {
  const { list, loading, reload } = usePelanggan();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-slate-600">Pelanggan *</span>
      <div className="flex gap-2">
        <Select
          value={value}
          required
          disabled={loading || disabled}
          onChange={(e) => {
            const id = e.target.value;
            onSelect(id, list.find((p) => p.id === id) ?? null);
          }}
          className="flex-1"
        >
          <option value="">{loading ? "Memuat pelanggan..." : list.length === 0 ? "Belum ada pelanggan" : "Pilih pelanggan"}</option>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={async () => {
            await reload();
            setDialogOpen(true);
          }}
          title="Tambah pelanggan baru"
        >
          <Plus className="h-3.5 w-3.5" /> Tambah
        </Button>
      </div>
      <TambahPelangganDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(p) => {
          reload();
          onSelect(p.id, p);
        }}
      />
    </div>
  );
}

// ---------- Tabel baris produk ----------
export type ItemBaris = {
  key: number;
  produkId: string;
  deskripsi: string;
  kuantitas: string;
  unit: string;
  harga: string;
  diskon: string;
};

export function hitungBaris(it: ItemBaris) {
  const qty = Number(it.kuantitas) || 0;
  const harga = Number(it.harga) || 0;
  const disk = Math.min(100, Math.max(0, Number(it.diskon) || 0));
  return Math.round(qty * harga * (1 - disk / 100) * 100) / 100;
}

function ItemsTable({
  items,
  setItems,
  locked,
}: {
  items: ItemBaris[];
  setItems: (next: ItemBaris[]) => void;
  locked?: boolean;
}) {
  // Nama produk: ketik bebas atau pilih dari persediaan (datalist).
  // Cocok persis dengan master → produkId terisi + satuan/harga terisi otomatis.
  const produk = useProduk();
  const tambahBaris = () =>
    setItems([...items, { key: Date.now() + Math.random(), produkId: "", deskripsi: "", kuantitas: "1", unit: "", harga: "", diskon: "0" }]);
  const ubah = (key: number, patch: Partial<ItemBaris>) =>
    setItems(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const ubahNamaProduk = (key: number, nama: string) => {
    const cocok = produk.find((x) => x.namaBarang.trim().toLowerCase() === nama.trim().toLowerCase());
    if (cocok) {
      ubah(key, { deskripsi: nama, produkId: cocok.id, unit: cocok.satuan, harga: String(cocok.hargaSatuan) });
    } else {
      ubah(key, { deskripsi: nama, produkId: "" });
    }
  };

  const total = items.reduce((s, it) => s + hitungBaris(it), 0);

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-500">
        Rincian Produk
      </div>
      <div className="space-y-3 p-4">
        <div className="hidden gap-3 px-3 text-xs font-medium text-slate-500 sm:grid sm:grid-cols-[minmax(0,2fr)_88px_72px_132px_72px_128px_32px]">
          <span className="whitespace-nowrap">Nama Produk</span>
          <span className="whitespace-nowrap text-right">Kuantitas</span>
          <span className="whitespace-nowrap">Unit</span>
          <span className="whitespace-nowrap text-right">Harga Satuan</span>
          <span className="whitespace-nowrap text-right">Diskon %</span>
          <span className="whitespace-nowrap text-right">Jumlah</span>
          <span />
        </div>
        <datalist id="penjualan-produk-list">
          {produk.map((p) => (
            <option key={p.id} value={p.namaBarang}>
              {p.satuan} · Rp {formatRupiah(p.hargaSatuan)}
            </option>
          ))}
        </datalist>
        {items.map((it) => (
          <div
            key={it.key}
            className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-[minmax(0,2fr)_88px_72px_132px_72px_128px_32px]"
          >
            <div className="col-span-2 sm:col-span-1">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 sm:hidden">Nama Produk</span>
              <Input
                value={it.deskripsi}
                onChange={(e) => ubahNamaProduk(it.key, e.target.value)}
                placeholder="Nama produk *"
                maxLength={500}
                required
                disabled={locked}
                list="penjualan-produk-list"
                autoComplete="off"
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-600 sm:hidden">Kuantitas</span>
              <Input type="number" min="0" step="any" value={it.kuantitas} onChange={(e) => ubah(it.key, { kuantitas: e.target.value })} required disabled={locked} className="text-right" />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-600 sm:hidden">Unit</span>
              <Input value={it.unit} onChange={(e) => ubah(it.key, { unit: e.target.value })} placeholder="kg" maxLength={20} required disabled={locked} />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-600 sm:hidden">Harga Satuan</span>
              <Input type="number" min="0" step="any" value={it.harga} onChange={(e) => ubah(it.key, { harga: e.target.value })} required disabled={locked} className="text-right" />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-600 sm:hidden">Diskon %</span>
              <Input type="number" min="0" max="100" step="any" value={it.diskon} onChange={(e) => ubah(it.key, { diskon: e.target.value })} disabled={locked} className="text-right" />
            </div>
            <div className="flex h-10 items-center justify-end text-sm font-medium tracking-tight sm:justify-end">
              Rp {formatRupiah(hitungBaris(it))}
            </div>
            <div className="flex h-10 items-center justify-end sm:justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 rounded-full p-0 text-slate-400 hover:text-red-600"
                onClick={() => setItems(items.filter((x) => x.key !== it.key))}
                title="Hapus baris"
                disabled={locked || items.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {locked && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            Rincian dikunci karena piutang dokumen ini sudah ada pembayaran tercatat.
          </p>
        )}
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={tambahBaris} disabled={locked}>
            <Plus className="h-3.5 w-3.5" /> Tambah Baris
          </Button>
          <p className="text-sm font-semibold tracking-tight text-slate-900">Total: Rp {formatRupiah(total)}</p>
        </div>
      </div>
    </div>
  );
}

// ---------- Lampiran (mendukung file lama saat mode edit) ----------
export type LampiranItem = Lampiran & { key: string; id?: string };

function LampiranUploader({
  value,
  onAdd,
  onRemove,
}: {
  value: LampiranItem[];
  onAdd: (next: Lampiran[]) => void;
  onRemove: (key: string) => void;
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
      const res = await fetch("/api/penjualan/lampiran", { method: "POST", body: formData });
      const result = await res.json().catch(() => ({}));
      if (result.success) {
        const uploaded = (result.data?.items ?? []) as Lampiran[];
        const failed = (result.data?.errors ?? []) as { message?: string; fileName?: string }[];
        if (uploaded.length > 0) onAdd(uploaded);
        if (failed.length > 0) setErrors(failed.map((e) => e.message || e.fileName || "File ditolak"));
        else if (uploaded.length === 0) setErrors(["Tidak ada file yang berhasil ditambahkan"]);
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Lampiran</span>
        <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          {uploading ? "Mengunggah..." : "Tambah lampiran"}
        </Button>
      </div>
      {errors.length > 0 && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-600">
          <ul className="list-disc space-y-0.5 pl-4">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {value.length > 0 ? (
        <ul className="space-y-1.5">
          {value.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{item.fileName}</span>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 shrink-0 rounded-full p-0 text-slate-400 hover:text-red-600" onClick={() => onRemove(item.key)} title="Hapus dari daftar">
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">Belum ada lampiran</p>
      )}
    </div>
  );
}

// ---------- Shell & submit ----------
async function postDokumen(payload: Record<string, unknown>) {
  const res = await fetch("/api/penjualan/dokumen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await res.json().catch(() => ({ message: "Gagal menyimpan dokumen" }));
  if (!res.ok) throw new Error(fieldError(result, "Gagal menyimpan dokumen"));
  return result.data;
}

function DocShell({
  title,
  subtitle,
  error,
  saving,
  noLabel,
  noPrefix,
  onSubmit,
  onCancel,
  children,
}: {
  title: string;
  subtitle: string;
  error: string;
  saving: boolean;
  noLabel: string;
  noPrefix: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit}>
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
              {noLabel}: otomatis ({noPrefix}-...)
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 sm:p-6">{children}</CardContent>
      </Card>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

type HeaderState = {
  pelangganId: string;
  email: string;
  alamat: string;
  tanggal: string;
  jatuhTempo: string;
  noRef: string;
  syarat: string;
  pesan: string;
  memo: string;
  // Jenis penjualan (khusus PENAGIHAN) → akun pendapatan otomatis.
  jenis: JenisPenjualan;
};

const emptyHeader = (): HeaderState => ({
  pelangganId: "",
  email: "",
  alamat: "",
  tanggal: todayInput(),
  jatuhTempo: "",
  noRef: "",
  syarat: "",
  pesan: "",
  memo: "",
  jenis: "HASIL_KEBUN",
});

const emptyItems = (): ItemBaris[] => [
  { key: Date.now() + Math.random(), produkId: "", deskripsi: "", kuantitas: "1", unit: "", harga: "", diskon: "0" },
];

export type DocInitial = {
  id: string;
  header: HeaderState;
  items: ItemBaris[];
  lampiran: LampiranItem[];
  lockedTotal: boolean;
  referensiIds: string[];
  pelangganNama?: string;
};

const TAB_BY_TIPE: Record<TipeDokumen, string> = {
  PENAWARAN: "penawaran",
  PESANAN: "pesanan",
  PROFORMA: "penagihan",
  TUKAR_FAKTUR: "penagihan",
  PENAGIHAN: "penagihan",
};

function useDocForm(tipe: TipeDokumen, initial?: DocInitial | null) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [header, setHeader] = useState<HeaderState>(initial?.header ?? emptyHeader());
  const [items, setItems] = useState<ItemBaris[]>(initial?.items ?? emptyItems());
  const [lampiran, setLampiran] = useState<LampiranItem[]>(initial?.lampiran ?? []);
  const [hapusLampiranIds, setHapusLampiranIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof HeaderState>(k: K, v: HeaderState[K]) =>
    setHeader((h) => ({ ...h, [k]: v }));

  const tambahLampiran = (baru: Lampiran[]) =>
    setLampiran((cur) => [...cur, ...baru.map((l) => ({ ...l, key: `new-${Date.now()}-${Math.random()}` }))]);
  const hapusLampiran = (key: string) =>
    setLampiran((cur) => {
      const target = cur.find((l) => l.key === key);
      if (target?.id) setHapusLampiranIds((ids) => [...ids, target.id as string]);
      return cur.filter((l) => l.key !== key);
    });

  const submit = async (e: FormEvent<HTMLFormElement>, extra: Record<string, unknown> = {}) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!header.pelangganId) throw new Error("Pelanggan wajib dipilih");
      const payload = {
        ...(isEdit ? {} : { tipe, pelangganId: header.pelangganId }),
        // Jenis penjualan hanya dikirim untuk PENAGIHAN (akun pendapatan otomatis).
        ...(tipe === "PENAGIHAN" ? { jenis: header.jenis } : {}),
        email: header.email.trim() || undefined,
        alamat: header.alamat.trim() || undefined,
        tanggal: header.tanggal || undefined,
        jatuhTempo: header.jatuhTempo || undefined,
        noRefPelanggan: header.noRef.trim() || undefined,
        syaratPembayaran: header.syarat.trim() || undefined,
        pesan: header.pesan.trim() || undefined,
        memo: header.memo.trim() || undefined,
        // Rantai dokumen: pertahankan referensi asal (mis. Penagihan dari Pesanan
        // menyimpan id Pesanan) agar hubungan dapat ditelusuri. Extra boleh menimpa.
        referensiIds: initial?.referensiIds ?? [],
        items: items.map((it) => ({
          produkId: it.produkId || undefined,
          deskripsi: it.deskripsi.trim(),
          kuantitas: Number(it.kuantitas),
          unit: it.unit.trim(),
          harga: Number(it.harga),
          diskonPersen: Number(it.diskon) || 0,
        })),
        ...(lampiran.filter((l) => !l.id).length > 0
          ? { lampiran: lampiran.filter((l) => !l.id).map(({ fileName, fileUrl, fileType, fileSize }) => ({ fileName, fileUrl, fileType, fileSize })) }
          : {}),
        ...(isEdit ? { hapusLampiranIds } : {}),
        ...extra,
      };
      if (isEdit && initial) {
        const res = await fetch(`/api/penjualan/dokumen/${encodeURIComponent(initial.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json().catch(() => ({ message: "Gagal menyimpan perubahan" }));
        if (!res.ok) throw new Error(fieldError(result, "Gagal menyimpan perubahan"));
      } else {
        await postDokumen({ ...payload, tipe, pelangganId: header.pelangganId });
      }
      router.push(`/keuangan/penjualan?tab=${TAB_BY_TIPE[tipe]}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan dokumen");
    } finally {
      setSaving(false);
    }
  };

  return {
    header, set, items, setItems, lampiran, tambahLampiran, hapusLampiran,
    saving, error, submit, router, isEdit, lockedTotal: initial?.lockedTotal ?? false,
  };
}

function HeaderFields({
  header,
  set,
  tanggalLabel,
  tempoLabel,
  tempoRequired,
  showNoRef,
  showSyarat,
}: {
  header: HeaderState;
  set: <K extends keyof HeaderState>(k: K, v: HeaderState[K]) => void;
  tanggalLabel: string;
  tempoLabel: string;
  tempoRequired?: boolean;
  showNoRef?: boolean;
  showSyarat?: boolean;
}) {
  // Pilih syarat -> tanggal jatuh tempo terisi otomatis sesuai durasi tempo.
  // Ubah tanggal -> jatuh tempo ikut bergeser bila syarat berupa tempo.
  const pilihSyarat = (s: string) => {
    set("syarat", s);
    const jt = jatuhTempoDari(header.tanggal, s);
    if (jt) set("jatuhTempo", jt);
  };
  const ubahTanggal = (tgl: string) => {
    set("tanggal", tgl);
    if (header.syarat) {
      const jt = jatuhTempoDari(tgl, header.syarat);
      if (jt) set("jatuhTempo", jt);
    }
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <PelangganField
          value={header.pelangganId}
          onSelect={(id, p) => {
            set("pelangganId", id);
            if (!p) return;
            set("email", p.email ?? "");
            set("alamat", p.alamat ?? "");
          }}
        />
      </div>
      <Field label="Email">
        <Input type="email" value={header.email} onChange={(e) => set("email", e.target.value)} placeholder="Email pelanggan" maxLength={100} />
      </Field>
      <Field label="Alamat penagihan">
        <Input value={header.alamat} onChange={(e) => set("alamat", e.target.value)} placeholder="Alamat pelanggan" maxLength={1000} />
      </Field>
      <Field label={tanggalLabel}>
        <Input type="date" value={header.tanggal} onChange={(e) => ubahTanggal(e.target.value)} required />
      </Field>
      <Field label={`${tempoLabel}${tempoRequired ? " *" : ""}`}>
        <Input type="date" value={header.jatuhTempo} onChange={(e) => set("jatuhTempo", e.target.value)} required={tempoRequired} />
      </Field>
      {showNoRef && (
        <Field label="No. referensi pelanggan">
          <Input value={header.noRef} onChange={(e) => set("noRef", e.target.value)} placeholder="No. PO / referensi pelanggan" maxLength={50} />
        </Field>
      )}
      {showSyarat && (
        <Field label="Syarat pembayaran">
          <Select value={header.syarat} onChange={(e) => pilihSyarat(e.target.value)}>
            <option value="">Pilih syarat</option>
            {SYARAT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </div>
  );
}

function PesanMemoLampiran({
  header,
  set,
  lampiran,
  tambahLampiran,
  hapusLampiran,
}: {
  header: HeaderState;
  set: <K extends keyof HeaderState>(k: K, v: HeaderState[K]) => void;
  lampiran: LampiranItem[];
  tambahLampiran: (baru: Lampiran[]) => void;
  hapusLampiran: (key: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Pesan">
        <Textarea value={header.pesan} onChange={(e) => set("pesan", e.target.value)} placeholder="Pesan untuk pelanggan (opsional)" />
      </Field>
      <Field label="Memo">
        <Textarea value={header.memo} onChange={(e) => set("memo", e.target.value)} placeholder="Catatan internal (opsional)" />
      </Field>
      <div className="sm:col-span-2">
        <LampiranUploader value={lampiran} onAdd={tambahLampiran} onRemove={hapusLampiran} />
      </div>
    </div>
  );
}

// ================= 1. PENAGIHAN (menghasilkan PIUTANG, tanpa Kas) =================
export function PenagihanForm({ initial }: { initial?: DocInitial | null }) {
  const f = useDocForm("PENAGIHAN", initial);
  const bruto = f.items.reduce((s,it)=> s + (Number(it.kuantitas)||0)*(Number(it.harga)||0),0);
  const subtotal = f.items.reduce((s,it)=> s + hitungBaris(it),0);
  const pemotongan = Math.round((bruto - subtotal)*100)/100;
  return (
    <DocShell
      title={f.isEdit ? "Ubah Penagihan Penjualan" : "Penagihan Penjualan"}
      subtitle="Invoice resmi ke pelanggan. Tersimpan sebagai piutang — Kas & Bank tercatat saat pelanggan membayar."
      error={f.error}
      saving={f.saving}
      noLabel="No. Invoice"
      noPrefix="INV"
      onSubmit={(e) => f.submit(e)}
      onCancel={() => f.router.push("/keuangan/penjualan?tab=penagihan")}
    >
      <HeaderFields
        header={f.header}
        set={f.set}
        tanggalLabel="Tanggal transaksi"
        tempoLabel="Tanggal jatuh tempo"
        tempoRequired
        showNoRef
        showSyarat
      />
      <p className="-mt-2 text-[11px] leading-relaxed text-slate-400">
        Belum dibayar: debit 1102 - Piutang, kredit akun pendapatan otomatis berdasarkan jenis penjualan. Kas/Bank/Tabungan bertambah saat
        pelanggan membayar di Hutang & Piutang.
      </p>
      <ItemsTable items={f.items} setItems={f.setItems} locked={f.lockedTotal} />
      <PesanMemoLampiran header={f.header} set={f.set} lampiran={f.lampiran} tambahLampiran={f.tambahLampiran} hapusLampiran={f.hapusLampiran} />
      <div className="ml-auto w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <span>Subtotal</span>
          <span className="font-medium tabular-nums text-slate-900">Rp {formatRupiah(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span>Pemotongan (diskon per baris)</span>
          <span className="font-medium tabular-nums text-slate-900">Rp {formatRupiah(pemotongan)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
          <span>Total</span>
          <span className="tabular-nums">Rp {formatRupiah(subtotal)}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Belum dibayar: debit 1102 - Piutang, kredit pendapatan otomatis. Kas/Bank bertambah saat pelanggan membayar di Hutang & Piutang.
        </p>
      </div>
    </DocShell>
  );
}

// ================= 2. PROFORMA (dokumen sementara, tanpa piutang/Kas) =================
export function ProformaForm({ initial }: { initial?: DocInitial | null }) {
  const f = useDocForm("PROFORMA", initial);
  const bruto = f.items.reduce((s,it)=> s + (Number(it.kuantitas)||0)*(Number(it.harga)||0),0);
  const subtotal = f.items.reduce((s,it)=> s + hitungBaris(it),0);
  const pemotongan = Math.round((bruto - subtotal)*100)/100;
  return (
    <DocShell
      title={f.isEdit ? "Ubah Faktur Proforma" : "Faktur Proforma"}
      subtitle="Dokumen sementara, bukan tagihan resmi. Tidak membuat piutang maupun transaksi Kas & Bank."
      error={f.error}
      saving={f.saving}
      noLabel="No. Proforma"
      noPrefix="PRO"
      onSubmit={(e) => f.submit(e)}
      onCancel={() => f.router.push("/keuangan/penjualan?tab=penagihan")}
    >
      <HeaderFields
        header={f.header}
        set={f.set}
        tanggalLabel="Tanggal transaksi"
        tempoLabel="Tanggal berlaku/kedaluwarsa"
      />
      <ItemsTable items={f.items} setItems={f.setItems} locked={f.lockedTotal} />
      <PesanMemoLampiran header={f.header} set={f.set} lampiran={f.lampiran} tambahLampiran={f.tambahLampiran} hapusLampiran={f.hapusLampiran} />
      <div className="ml-auto w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <span>Subtotal</span>
          <span className="font-medium tabular-nums text-slate-900">Rp {formatRupiah(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span>Pemotongan (diskon per baris)</span>
          <span className="font-medium tabular-nums text-slate-900">Rp {formatRupiah(pemotongan)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
          <span>Total</span>
          <span className="tabular-nums">Rp {formatRupiah(subtotal)}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Proforma tidak menghasilkan piutang maupun transaksi Kas & Bank.
        </p>
      </div>
    </DocShell>
  );
}

// ================= 4. PESANAN (tanpa piutang/Kas) =================
export function PesananForm({ initial }: { initial?: DocInitial | null }) {
  const f = useDocForm("PESANAN", initial);
  const bruto = f.items.reduce((s,it)=> s + (Number(it.kuantitas)||0)*(Number(it.harga)||0),0);
  const subtotal = f.items.reduce((s,it)=> s + hitungBaris(it),0);
  const pemotongan = Math.round((bruto - subtotal)*100)/100;
  return (
    <DocShell
      title={f.isEdit ? "Ubah Pesanan Penjualan" : "Pesanan Penjualan"}
      subtitle="Mencatat pesanan pelanggan. Belum menjadi piutang maupun pemasukan Kas & Bank."
      error={f.error}
      saving={f.saving}
      noLabel="No. Pesanan"
      noPrefix="SO"
      onSubmit={(e) => f.submit(e)}
      onCancel={() => f.router.push("/keuangan/penjualan?tab=pesanan")}
    >
      <HeaderFields
        header={f.header}
        set={f.set}
        tanggalLabel="Tanggal transaksi"
        tempoLabel="Tanggal jatuh tempo/target"
        showNoRef
        showSyarat
      />
      <ItemsTable items={f.items} setItems={f.setItems} locked={f.lockedTotal} />
      <PesanMemoLampiran header={f.header} set={f.set} lampiran={f.lampiran} tambahLampiran={f.tambahLampiran} hapusLampiran={f.hapusLampiran} />
      <div className="ml-auto w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <span>Subtotal</span>
          <span className="font-medium tabular-nums text-slate-900">Rp {formatRupiah(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span>Pemotongan (diskon per baris)</span>
          <span className="font-medium tabular-nums text-slate-900">Rp {formatRupiah(pemotongan)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
          <span>Total</span>
          <span className="tabular-nums">Rp {formatRupiah(subtotal)}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Pesanan tidak menghasilkan piutang maupun transaksi Kas & Bank.
        </p>
      </div>
    </DocShell>
  );
}

// ================= 5. PENAWARAN (tanpa piutang/Kas) =================
export function PenawaranForm({ initial }: { initial?: DocInitial | null }) {
  const f = useDocForm("PENAWARAN", initial);
  const bruto = f.items.reduce((s,it)=> s + (Number(it.kuantitas)||0)*(Number(it.harga)||0),0);
  const subtotal = f.items.reduce((s,it)=> s + hitungBaris(it),0);
  const pemotongan = Math.round((bruto - subtotal)*100)/100;
  return (
    <DocShell
      title={f.isEdit ? "Ubah Penawaran Penjualan" : "Penawaran Penjualan"}
      subtitle="Hanya mencatat penawaran harga. Tidak membuat piutang maupun transaksi Kas & Bank."
      error={f.error}
      saving={f.saving}
      noLabel="No. Penawaran"
      noPrefix="QTN"
      onSubmit={(e) => f.submit(e)}
      onCancel={() => f.router.push("/keuangan/penjualan?tab=penawaran")}
    >
      <HeaderFields
        header={f.header}
        set={f.set}
        tanggalLabel="Tanggal penawaran"
        tempoLabel="Tanggal kedaluwarsa"
        showNoRef
        showSyarat
      />
      <ItemsTable items={f.items} setItems={f.setItems} locked={f.lockedTotal} />
      <PesanMemoLampiran header={f.header} set={f.set} lampiran={f.lampiran} tambahLampiran={f.tambahLampiran} hapusLampiran={f.hapusLampiran} />
      <div className="ml-auto w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <span>Subtotal</span>
          <span className="font-medium tabular-nums text-slate-900">Rp {formatRupiah(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span>Pemotongan (diskon per baris)</span>
          <span className="font-medium tabular-nums text-slate-900">Rp {formatRupiah(pemotongan)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
          <span>Total</span>
          <span className="tabular-nums">Rp {formatRupiah(subtotal)}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Penawaran tidak menghasilkan piutang maupun transaksi Kas & Bank.
        </p>
      </div>
    </DocShell>
  );
}

// ================= 3. TUKAR FAKTUR (merujuk faktur yang sudah ada) =================
type FakturTersedia = {
  id: string;
  noInvoice: string | null;
  pihak: string;
  keterangan: string | null;
  tanggal: string;
  jatuhTempo: string | null;
  status: string;
  jumlah: number;
  sisa: number;
};

export function TukarFakturForm({ initial }: { initial?: DocInitial | null }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [pelangganId, setPelangganId] = useState(initial?.header.pelangganId ?? "");
  const [pelangganNama, setPelangganNama] = useState(initial?.pelangganNama ?? "");
  const [email, setEmail] = useState(initial?.header.email ?? "");
  const [alamat, setAlamat] = useState(initial?.header.alamat ?? "");
  const [tanggal, setTanggal] = useState(initial?.header.tanggal || todayInput());
  const [jatuhTempo, setJatuhTempo] = useState(initial?.header.jatuhTempo ?? "");
  const [syarat, setSyarat] = useState(initial?.header.syarat ?? "");
  const [pesan, setPesan] = useState(initial?.header.pesan ?? "");
  const [memo, setMemo] = useState(initial?.header.memo ?? "");
  const [lampiran, setLampiran] = useState<LampiranItem[]>(initial?.lampiran ?? []);
  const [hapusLampiranIds, setHapusLampiranIds] = useState<string[]>([]);
  const [cari, setCari] = useState(initial?.pelangganNama ?? "");
  const [daftar, setDaftar] = useState<FakturTersedia[]>([]);
  const [memuat, setMemuat] = useState(() => Boolean(initial?.referensiIds.length));
  const [dipilih, setDipilih] = useState<string[]>(initial?.referensiIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Mode edit: tampilkan faktur yang sudah dirujuk (bisa jadi sudah lunas / tak lagi tersedia).
  useEffect(() => {
    if (!initial?.referensiIds.length) return;
    let cancelled = false;
    Promise.all(
      (initial?.referensiIds ?? []).map((id) =>
        fetch(`/api/tagihan/${encodeURIComponent(id)}`, { credentials: "include" })
          .then((res) => (res.ok ? res.json() : null))
          .then((result) => (result?.success ? result.data : null))
          .catch(() => null)
      )
    )
      .then((rows) => {
        if (cancelled) return;
        setDaftar(
          rows.filter(Boolean).map(
            (r: {
              id: string;
              pihak: string;
              keterangan: string | null;
              tanggal: string;
              jatuhTempo: string | null;
              status: string;
              jumlah: number;
              sisa: number;
            }) => ({
              id: r.id,
              noInvoice: null,
              pihak: r.pihak,
              keterangan: r.keterangan,
              tanggal: r.tanggal,
              jatuhTempo: r.jatuhTempo,
              status: r.status,
              jumlah: Number(r.jumlah),
              sisa: Number(r.sisa),
            })
          )
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMemuat(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const muatFaktur = async (keyword: string) => {
    setMemuat(true);
    try {
      const res = await fetch(`/api/penjualan/piutang-tersedia?q=${encodeURIComponent(keyword)}`, {
        credentials: "include",
      });
      const result = await res.json().catch(() => null);
      if (result?.success && Array.isArray(result.data)) setDaftar(result.data);
      else setDaftar([]);
    } catch {
      setDaftar([]);
    } finally {
      setMemuat(false);
    }
  };

  const pilihPelanggan = (id: string, nama: string, pemail: string, palamat: string) => {
    setPelangganId(id);
    setPelangganNama(nama);
    setEmail(pemail);
    setAlamat(palamat);
    setDipilih([]);
    setCari(nama);
    muatFaktur(nama);
  };

  const toggle = (id: string) =>
    setDipilih((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const totalDipilih = daftar.filter((d) => dipilih.includes(d.id)).reduce((s, d) => s + d.sisa, 0);

  const tambahLampiran = (baru: Lampiran[]) =>
    setLampiran((cur) => [...cur, ...baru.map((l) => ({ ...l, key: `new-${Date.now()}-${Math.random()}` }))]);
  const hapusLampiran = (key: string) =>
    setLampiran((cur) => {
      const target = cur.find((l) => l.key === key);
      if (target?.id) setHapusLampiranIds((ids) => [...ids, target.id as string]);
      return cur.filter((l) => l.key !== key);
    });

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!pelangganId) throw new Error("Pelanggan wajib dipilih");
      if (dipilih.length === 0) throw new Error("Pilih minimal 1 faktur/penagihan yang akan ditukar");
      const payload = {
        email: email.trim() || undefined,
        alamat: alamat.trim() || undefined,
        tanggal: tanggal || undefined,
        jatuhTempo: jatuhTempo || undefined,
        syaratPembayaran: syarat.trim() || undefined,
        pesan: pesan.trim() || undefined,
        memo: memo.trim() || undefined,
        items: [],
        referensiIds: dipilih,
        ...(lampiran.filter((l) => !l.id).length > 0
          ? { lampiran: lampiran.filter((l) => !l.id).map(({ fileName, fileUrl, fileType, fileSize }) => ({ fileName, fileUrl, fileType, fileSize })) }
          : {}),
      };
      if (isEdit && initial) {
        const res = await fetch(`/api/penjualan/dokumen/${encodeURIComponent(initial.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, hapusLampiranIds }),
        });
        const result = await res.json().catch(() => ({ message: "Gagal menyimpan perubahan" }));
        if (!res.ok) throw new Error(fieldError(result, "Gagal menyimpan perubahan"));
      } else {
        await postDokumen({ ...payload, tipe: "TUKAR_FAKTUR", pelangganId });
      }
      router.push("/keuangan/penjualan?tab=penagihan");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan tukar faktur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DocShell
      title={isEdit ? "Ubah Tukar Faktur" : "Tukar Faktur"}
      subtitle="Dibuat berdasarkan faktur/penagihan yang sudah ada. Tidak membuat piutang atau Kas & Bank baru."
      error={error}
      saving={saving}
      noLabel="No. Tukar Faktur"
      noPrefix="TF"
      onSubmit={submit}
      onCancel={() => router.push("/keuangan/penjualan?tab=penagihan")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <PelangganField
            value={pelangganId}
            disabled={isEdit}
            onSelect={(id, p) => {
              if (isEdit) return;
              if (!p) {
                setPelangganId("");
                setPelangganNama("");
                setDipilih([]);
                return;
              }
              pilihPelanggan(id, p.nama, p.email ?? "", p.alamat ?? "");
            }}
          />
          {isEdit && (
            <p className="mt-1.5 text-[11px] text-slate-400">Pelanggan dikunci agar rujukan faktur tetap konsisten.</p>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email pelanggan" maxLength={100} />
        </Field>
        <Field label="Alamat penagihan">
          <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Alamat pelanggan" maxLength={1000} />
        </Field>
        <Field label="Tanggal transaksi">
          <Input type="date" value={tanggal} onChange={(e) => {
            const tgl = e.target.value;
            setTanggal(tgl);
            if (syarat) {
              const jt = jatuhTempoDari(tgl, syarat);
              if (jt) setJatuhTempo(jt);
            }
          }} required />
        </Field>
        <Field label="Tanggal jatuh tempo">
          <Input type="date" value={jatuhTempo} onChange={(e) => setJatuhTempo(e.target.value)} />
        </Field>
        <Field label="Syarat pembayaran" className="sm:col-span-2">
          <Select value={syarat} onChange={(e) => {
            const s = e.target.value;
            setSyarat(s);
            const jt = jatuhTempoDari(tanggal, s);
            if (jt) setJatuhTempo(jt);
          }}>
            <option value="">Pilih syarat</option>
            {SYARAT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="rounded-xl border border-slate-200">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <p className="text-xs font-medium text-slate-500">
            Pilih faktur/penagihan yang akan ditukar
            {pelangganNama ? ` — ${pelangganNama}` : ""}
          </p>
          <div className="flex gap-2 sm:ml-auto">
            <Input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari pelanggan..."
              className="sm:max-w-56"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => muatFaktur(cari)}>
              Cari
            </Button>
          </div>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto p-4">
          {memuat && <p className="py-4 text-center text-xs text-slate-400">Memuat faktur...</p>}
          {!memuat && daftar.length === 0 && (
            <p className="py-4 text-center text-xs text-slate-400">
              {!pelangganId && !cari
                ? "Pilih pelanggan untuk menampilkan faktur yang tersedia"
                : "Tidak ada piutang yang tersedia"}
            </p>
          )}
          {daftar.map((d) => {
            const checked = dipilih.includes(d.id);
            return (
              <label
                key={d.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  checked ? "border-green-600 bg-green-50/50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(d.id)}
                  className="mt-1 h-4 w-4 accent-green-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">
                    {d.noInvoice ?? `…${d.id.slice(-6).toUpperCase()}`} — {d.pihak}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {d.keterangan || "Tanpa deskripsi"} · Tempo:{" "}
                    {d.jatuhTempo
                      ? new Date(d.jatuhTempo).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}{" "}
                    · {d.status === "LUNAS_SEBAGIAN" ? "Lunas Sebagian" : "Belum Lunas"}
                  </span>
                  <span className="mt-1 block text-xs text-slate-600">
                    Tagihan Rp {formatRupiah(d.jumlah)} · Sisa Rp {formatRupiah(d.sisa)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {dipilih.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-600">
            {dipilih.length} faktur dipilih · Total sisa Rp {formatRupiah(totalDipilih)}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pesan">
          <Textarea value={pesan} onChange={(e) => setPesan(e.target.value)} placeholder="Pesan untuk pelanggan (opsional)" />
        </Field>
        <Field label="Memo">
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Catatan internal (opsional)" />
        </Field>
        <div className="sm:col-span-2">
          <LampiranUploader value={lampiran} onAdd={tambahLampiran} onRemove={hapusLampiran} />
        </div>
      </div>
    </DocShell>
  );
}
