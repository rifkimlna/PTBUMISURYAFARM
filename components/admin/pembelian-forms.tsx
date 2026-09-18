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

type Produk = { id: string; namaBarang: string; kategori: string; satuan: string; hargaSatuan: number };
type Lampiran = { fileName: string; fileUrl: string; fileType: string; fileSize: number };
type Supplier = { id: string; nama: string; email?: string | null; telepon?: string | null; alamat?: string | null };

export const SYARAT_OPTIONS = ["Tunai", "Tempo 7 hari", "Tempo 14 hari", "Tempo 30 hari"];

export function todayInput() {
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

function fieldError(result: { errors?: Array<{ message: string }> }, fallback: string) {
  const detail = Array.isArray(result.errors) ? result.errors.map((e) => e.message).join("; ") : null;
  return detail || (result as { message?: string }).message || fallback;
}

async function fetchSupplier(): Promise<Supplier[]> {
  const res = await fetch("/api/supplier?limit=200", { credentials: "include" });
  const result = await res.json().catch(() => null);
  if (result?.success && Array.isArray(result.data)) return result.data as Supplier[];
  return [];
}

function useSupplier() {
  const [list, setList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try {
      setList(await fetchSupplier());
    } catch {
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    fetchSupplier()
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

// Produk persediaan dari database untuk saran nama produk + akun otomatis.
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
arr.map((b: { id: string; namaBarang: string; kategori: string; satuan: string; hargaSatuan: number }) => ({
               id: b.id,
               namaBarang: b.namaBarang,
               kategori: b.kategori,
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

// ---------- Baris produk (akun COA ditentukan otomatis, bukan input user) ----------

function TambahSupplierDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (p: Supplier) => void;
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
      const res = await fetch("/api/supplier", {
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
      if (!res.ok) throw new Error(fieldError(result, "Gagal tambah supplier"));
      onCreated(result.data as Supplier);
      setNama("");
      setEmail("");
      setTelepon("");
      setAlamat("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal tambah supplier");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return createPortal(
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Supplier</DialogTitle>
          <DialogDescription>Kontak supplier PT Bumi Surya Farm.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Nama supplier *">
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama / usaha supplier" maxLength={100} required />
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
              {saving ? "Menyimpan..." : "Simpan Supplier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>,
    document.body
  );
}

function SupplierField({
  value,
  onSelect,
  disabled,
}: {
  value: string;
  onSelect: (id: string, p: Supplier | null) => void;
  disabled?: boolean;
}) {
  const { list, loading, reload } = useSupplier();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-slate-600">Supplier *</span>
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
          <option value="">{loading ? "Memuat supplier..." : list.length === 0 ? "Belum ada supplier" : "Pilih supplier"}</option>
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
          title="Tambah supplier baru"
        >
          <Plus className="h-3.5 w-3.5" /> Tambah
        </Button>
      </div>
      <TambahSupplierDialog
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

// ---------- Baris produk (akun COA ditentukan otomatis, bukan input user) ----------
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

// ---------- Baris produk (akun COA ditentukan otomatis, bukan input user) ----------
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
        <datalist id="pembelian-produk-list">
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
                list="pembelian-produk-list"
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
            Rincian dikunci karena utang faktur ini sudah ada pembayaran tercatat.
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

// ---------- Lampiran ----------
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
      const res = await fetch("/api/pembelian/lampiran", { method: "POST", body: formData });
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
    <div>
      <span className="text-xs font-medium text-slate-600">Lampiran</span>
      <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      {value.length > 0 && (
        <ul className="mt-2 space-y-1.5">
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
      <Button type="button" variant="outline" size="sm" className="mt-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
        {uploading ? "Mengupload..." : "+ Tambah Lampiran"}
      </Button>
    </div>
  );
}

// ---------- Form Faktur ----------
type HeaderState = {
  supplierId: string;
  email: string;
  alamat: string;
  tanggal: string;
  jatuhTempo: string;
  noRef: string;
  syarat: string;
  gudang: string;
  tag: string;
  pesan: string;
  memo: string;
};

const emptyHeader = (): HeaderState => ({
  supplierId: "",
  email: "",
  alamat: "",
  tanggal: todayInput(),
  jatuhTempo: "",
  noRef: "",
  syarat: "",
  gudang: "",
  tag: "",
  pesan: "",
  memo: "",
});

const emptyItems = (): ItemBaris[] => [
  { key: Date.now() + Math.random(), produkId: "", deskripsi: "", kuantitas: "1", unit: "", harga: "", diskon: "0" },
];

export type FakturInitial = {
  id: string;
  noFaktur?: string;
  header: HeaderState;
  items: ItemBaris[];
  lampiran: LampiranItem[];
  lockedTotal: boolean;
  supplierNama?: string;
};

export function FakturForm({ initial }: { initial?: FakturInitial | null }) {
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

  // Ringkasan bawah (Mekari): Subtotal = jumlah baris setelah diskon,
  // Pemotongan = total diskon per baris, Total = Subtotal.
  const bruto = items.reduce((s, it) => s + (Number(it.kuantitas) || 0) * (Number(it.harga) || 0), 0);
  const subtotal = items.reduce((s, it) => s + hitungBaris(it), 0);
  const pemotongan = Math.round((bruto - subtotal) * 100) / 100;

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
      if (!header.supplierId) throw new Error("Supplier wajib dipilih");
      const payload = {
        ...(isEdit ? {} : { supplierId: header.supplierId }),
        email: header.email.trim() || undefined,
        alamat: header.alamat.trim() || undefined,
        tanggal: header.tanggal || undefined,
        jatuhTempo: header.jatuhTempo || undefined,
        noRefSupplier: header.noRef.trim() || undefined,
        syaratPembayaran: header.syarat.trim() || undefined,
        gudang: header.gudang.trim() || undefined,
        tag: header.tag.trim() || undefined,
        pesan: header.pesan.trim() || undefined,
        memo: header.memo.trim() || undefined,
        // Tanpa kodeAkun: akun DEBIT ditentukan otomatis di backend
        // (produk master → persediaan 1105/1106/1107, selain itu → 5402).
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
      };
      const url = isEdit && initial ? `/api/pembelian/faktur/${encodeURIComponent(initial.id)}` : "/api/pembelian/faktur";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({ message: "Gagal menyimpan faktur" }));
      if (!res.ok) throw new Error(fieldError(result, "Gagal menyimpan faktur"));
      router.push("/keuangan/pembelian?tab=faktur");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan faktur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">{isEdit ? "Ubah Faktur Pembelian" : "Faktur Pembelian"}</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Tagihan dari supplier. Tersimpan sebagai utang (2101 - Utang Usaha) — Kas & Bank tercatat saat supplier dibayar.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
              {isEdit && initial?.noFaktur ? `No. ${initial.noFaktur}` : "No. Faktur: otomatis (FB-...)"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <SupplierField
                value={header.supplierId}
                onSelect={(id, p) => {
                  set("supplierId", id);
                  if (!p) return;
                  set("email", p.email ?? "");
                  set("alamat", p.alamat ?? "");
                }}
              />
            </div>
            <Field label="Email">
              <Input type="email" value={header.email} onChange={(e) => set("email", e.target.value)} placeholder="Email supplier" maxLength={100} />
            </Field>
            <Field label="Alamat penagihan">
              <Input value={header.alamat} onChange={(e) => set("alamat", e.target.value)} placeholder="Alamat supplier" maxLength={1000} />
            </Field>
            <Field label="Tanggal transaksi *">
              <Input type="date" value={header.tanggal} onChange={(e) => set("tanggal", e.target.value)} required />
            </Field>
            <Field label="Tanggal jatuh tempo *">
              <Input type="date" value={header.jatuhTempo} onChange={(e) => set("jatuhTempo", e.target.value)} required />
            </Field>
            <Field label="No. transaksi (otomatis)">
              <Input value={isEdit && initial?.noFaktur ? initial.noFaktur : "Otomatis — FB-YYYYMMDD-XXXX"} disabled className="bg-slate-50 text-slate-500" />
            </Field>
            <Field label="Nomor referensi supplier">
              <Input value={header.noRef} onChange={(e) => set("noRef", e.target.value)} placeholder="No. invoice supplier" maxLength={50} />
            </Field>
            <Field label="Syarat pembayaran">
              <Select value={header.syarat} onChange={(e) => set("syarat", e.target.value)}>
                <option value="">Pilih syarat</option>
                {SYARAT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Gudang">
              <Input value={header.gudang} onChange={(e) => set("gudang", e.target.value)} placeholder="Gudang tujuan barang" maxLength={100} />
            </Field>
            <Field label="Tag">
              <Input value={header.tag} onChange={(e) => set("tag", e.target.value)} placeholder="Tag transaksi (opsional)" maxLength={100} />
            </Field>
          </div>
          <ItemsTable items={items} setItems={setItems} locked={initial?.lockedTotal ?? false} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pesan">
              <Textarea value={header.pesan} onChange={(e) => set("pesan", e.target.value)} placeholder="Pesan untuk supplier (opsional)" />
            </Field>
            <Field label="Memo">
              <Textarea value={header.memo} onChange={(e) => set("memo", e.target.value)} placeholder="Catatan internal (opsional)" />
            </Field>
            <div className="sm:col-span-2">
              <LampiranUploader value={lampiran} onAdd={tambahLampiran} onRemove={hapusLampiran} />
            </div>
            <div className="sm:col-span-2">
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
                  Belum dibayar: debit persediaan/beban per baris, kredit 2101 - Utang Usaha. Kas/Bank berkurang saat
                  pembayaran di Hutang & Piutang.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/keuangan/pembelian?tab=faktur")} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
