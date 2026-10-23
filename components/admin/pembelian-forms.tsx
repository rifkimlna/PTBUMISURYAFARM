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

type Produk = { id: string; namaBarang: string; kategori: string; satuan: string; hargaSatuan: number };
export type Lampiran = { fileName: string; fileUrl: string; fileType: string; fileSize: number };
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

export function SupplierField({
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

export type HutangTersedia = {
  id: string;
  noFaktur: string | null;
  pihak: string;
  keterangan: string | null;
  tanggal: string;
  jatuhTempo: string | null;
  status: string;
  jumlah: number;
  sisa: number;
};

export type TukarFakturBeliInitial = {
  id: string;
  header: {
    supplierId: string;
    email: string;
    alamat: string;
    tanggal: string;
    jatuhTempo: string;
    syarat: string;
    pesan: string;
    memo: string;
  };
  lampiran: LampiranItem[];
  referensiIds: string[];
  supplierNama?: string;
};

export function hitungBaris(it: ItemBaris) {
  const qty = Number(it.kuantitas) || 0;
  const harga = Number(it.harga) || 0;
  const disk = Math.min(100, Math.max(0, Number(it.diskon) || 0));
  const bruto = qty * harga;
  if (disk === 0) return bruto;
  const discAmount = Math.round((bruto * disk) / 100);
  return bruto - discAmount;
}

// ---------- Baris produk (akun COA ditentukan otomatis, bukan input user) ----------
export function ItemsTable({
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

export function LampiranUploader({
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

export function FakturForm({ initial, title, subtitle, referensiIds, asalLabel }: { initial?: FakturInitial | null; title?: string; subtitle?: string; referensiIds?: string[]; asalLabel?: string }) {
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
      if (!header.syarat.trim()) throw new Error("Syarat pembayaran wajib dipilih");
      const payload = {
        ...(isEdit ? {} : { supplierId: header.supplierId }),
        ...(!isEdit && referensiIds && referensiIds.length > 0 ? { referensiIds } : {}),
        email: header.email.trim() || undefined,
        alamat: header.alamat.trim() || undefined,
        tanggal: header.tanggal || undefined,
        jatuhTempo: header.jatuhTempo || undefined,
        noRefSupplier: header.noRef.trim() || undefined,
        syaratPembayaran: header.syarat.trim(),
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
              <CardTitle className="text-base">{isEdit ? (title ? `Ubah ${title}` : "Ubah Faktur Pembelian") : (title || "Faktur Pembelian")}</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                {asalLabel || subtitle || "Tagihan dari supplier. Tersimpan sebagai utang (2101 - Utang Usaha) — Kas & Bank tercatat saat supplier dibayar."}
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
              <Input type="date" value={header.tanggal} onChange={(e) => {
                const tgl = e.target.value;
                set("tanggal", tgl);
                if (header.syarat) {
                  const jt = jatuhTempoDari(tgl, header.syarat);
                  if (jt) set("jatuhTempo", jt);
                }
              }} required />
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
            <Field label="Syarat pembayaran *">
              <Select value={header.syarat} onChange={(e) => {
                const s = e.target.value;
                set("syarat", s);
                const jt = jatuhTempoDari(header.tanggal, s);
                if (jt) set("jatuhTempo", jt);
              }} required>
                <option value="">Pilih syarat</option>
                {SYARAT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              {!header.syarat.trim() && (
                <p className="text-[11px] text-red-600">Syarat pembayaran wajib dipilih sebelum menyimpan.</p>
              )}
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
        <Button
          type="submit"
          disabled={saving || !header.syarat.trim()}
          title={!header.syarat.trim() ? "Pilih syarat pembayaran terlebih dahulu" : undefined}
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

// ---------- Form Tukar Faktur (pilih faktur pembelian berutang, tanpa rincian produk) ----------
export function TukarFakturBeliForm({ initial }: { initial?: TukarFakturBeliInitial | null }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [supplierId, setSupplierId] = useState(initial?.header.supplierId ?? "");
  const [supplierNama, setSupplierNama] = useState(initial?.supplierNama ?? "");
  const [email, setEmail] = useState(initial?.header.email ?? "");
  const [alamat, setAlamat] = useState(initial?.header.alamat ?? "");
  const [tanggal, setTanggal] = useState(initial?.header.tanggal || todayInput());
  const [jatuhTempo, setJatuhTempo] = useState(initial?.header.jatuhTempo ?? "");
  const [syarat, setSyarat] = useState(initial?.header.syarat ?? "");
  const [pesan, setPesan] = useState(initial?.header.pesan ?? "");
  const [memo, setMemo] = useState(initial?.header.memo ?? "");
  const [lampiran, setLampiran] = useState<LampiranItem[]>(initial?.lampiran ?? []);
  const [hapusLampiranIds, setHapusLampiranIds] = useState<string[]>([]);
  // Kata kunci dropdown faktur (nomor / supplier / keterangan) — independen dari SupplierField.
  const [cari, setCari] = useState("");
  const [daftar, setDaftar] = useState<HutangTersedia[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [dipilih, setDipilih] = useState<string[]>(initial?.referensiIds ?? []);
  const [dropdownBuka, setDropdownBuka] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Mode edit: tampilkan faktur yang sudah dirujuk (bisa jadi sudah lunas / tak lagi tersedia),
  // lalu gabungkan dengan daftar utang tersedia agar dropdown tetap lengkap.
  useEffect(() => {
    let cancelled = false;
    const muatAwal = async () => {
      setMemuat(true);
      try {
        const [rujukan, tersedia] = await Promise.all([
          initial?.referensiIds.length
            ? Promise.all(
                (initial?.referensiIds ?? []).map((id) =>
                  fetch(`/api/tagihan/${encodeURIComponent(id)}`, { credentials: "include" })
                    .then((res) => (res.ok ? res.json() : null))
                    .then((result) => (result?.success ? result.data : null))
                    .catch(() => null)
                )
              )
            : Promise.resolve([]),
          fetch("/api/pembelian/hutang-tersedia?q=", { credentials: "include" })
            .then((res) => res.json().catch(() => null))
            .then((result) => (result?.success && Array.isArray(result.data) ? result.data : []))
            .catch(() => []),
        ]);
        if (cancelled) return;
        const map = new Map<string, HutangTersedia>();
        for (const r of (rujukan as Array<{
          id: string;
          pihak: string;
          keterangan: string | null;
          tanggal: string;
          jatuhTempo: string | null;
          status: string;
          jumlah: number;
          sisa: number;
        }>).filter(Boolean)) {
          map.set(r.id, {
            id: r.id,
            noFaktur: null,
            pihak: r.pihak,
            keterangan: r.keterangan,
            tanggal: r.tanggal,
            jatuhTempo: r.jatuhTempo,
            status: r.status,
            jumlah: Number(r.jumlah),
            sisa: Number(r.sisa),
          });
        }
        for (const d of tersedia as HutangTersedia[]) {
          if (!map.has(d.id)) map.set(d.id, d);
        }
        setDaftar(Array.from(map.values()));
      } finally {
        if (!cancelled) setMemuat(false);
      }
    };
    muatAwal();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tutup dropdown saat klik di luar.
  useEffect(() => {
    if (!dropdownBuka) return;
    const tutup = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownBuka(false);
    };
    document.addEventListener("mousedown", tutup);
    return () => document.removeEventListener("mousedown", tutup);
  }, [dropdownBuka]);

  const muatHutang = async (keyword: string) => {
    setMemuat(true);
    try {
      const res = await fetch(`/api/pembelian/hutang-tersedia?q=${encodeURIComponent(keyword)}`, {
        credentials: "include",
      });
      const result = await res.json().catch(() => null);
      const tersedia: HutangTersedia[] =
        result?.success && Array.isArray(result.data) ? result.data : [];
      // Pertahankan baris yang sudah dipilih (mis. mode edit) agar tidak hilang saat pencarian.
      setDaftar((cur) => {
        const map = new Map(tersedia.map((d) => [d.id, d]));
        for (const d of cur) {
          if (dipilih.includes(d.id) && !map.has(d.id)) map.set(d.id, d);
        }
        return Array.from(map.values());
      });
    } catch {
      // Biarkan daftar lama (terutama yang sudah dipilih) tetap tampil.
    } finally {
      setMemuat(false);
    }
  };

  // Pilihan supplier hanya mengisi header — TIDAK memicu muat ulang / reset faktur,
  // agar faktur bisa dipilih dulu tanpa wajib cari supplier.
  const pilihSupplier = (id: string, nama: string, pemail: string, palamat: string) => {
    setSupplierId(id);
    setSupplierNama(nama);
    setEmail(pemail);
    setAlamat(palamat);
  };

  // Filter lokal agar pencarian nomor faktur / nama / keterangan terasa instan.
  const kataKunci = cari.trim().toLowerCase();
  const daftarTampil = kataKunci
    ? daftar.filter((d) =>
        [d.noFaktur ?? "", d.pihak, d.keterangan ?? "", d.status]
          .join(" ")
          .toLowerCase()
          .includes(kataKunci)
      )
    : daftar;

  const toggle = (id: string) =>
    setDipilih((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const totalDipilih = daftar.filter((d) => dipilih.includes(d.id)).reduce((s, d) => s + d.sisa, 0);
  const syaratKosong = !syarat.trim();

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
      if (!supplierId) throw new Error("Supplier wajib dipilih");
      if (!syarat.trim()) throw new Error("Syarat pembayaran wajib dipilih");
      if (dipilih.length === 0) throw new Error("Pilih minimal 1 faktur pembelian yang akan ditukar");
      const payload = {
        email: email.trim() || undefined,
        alamat: alamat.trim() || undefined,
        tanggal: tanggal || undefined,
        jatuhTempo: jatuhTempo || undefined,
        syaratPembayaran: syarat.trim(),
        pesan: pesan.trim() || undefined,
        memo: memo.trim() || undefined,
        items: [],
        referensiIds: dipilih,
        ...(lampiran.filter((l) => !l.id).length > 0
          ? { lampiran: lampiran.filter((l) => !l.id).map(({ fileName, fileUrl, fileType, fileSize }) => ({ fileName, fileUrl, fileType, fileSize })) }
          : {}),
      };
      const url = isEdit && initial ? `/api/pembelian/dokumen/${encodeURIComponent(initial.id)}` : "/api/pembelian/dokumen";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { ...payload, hapusLampiranIds }
            : { ...payload, tipe: "TUKAR_FAKTUR", supplierId }
        ),
      });
      const result = await res.json().catch(() => ({ message: "Gagal menyimpan tukar faktur" }));
      if (!res.ok) throw new Error(fieldError(result, "Gagal menyimpan tukar faktur"));
      router.push("/keuangan/pembelian?tab=tukar-faktur");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan tukar faktur");
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
              <CardTitle className="text-base">{isEdit ? "Ubah Tukar Faktur Pembelian" : "Tukar Faktur Pembelian"}</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Dibuat berdasarkan faktur pembelian yang sudah ada. Tidak membuat utang atau Kas & Bank baru.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
              No. Tukar Faktur: otomatis (TF-B-...)
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <SupplierField
                value={supplierId}
                disabled={isEdit}
                onSelect={(id, p) => {
                  if (isEdit) return;
                  if (!p) {
                    setSupplierId("");
                    setSupplierNama("");
                    setDipilih([]);
                    return;
                  }
                  pilihSupplier(id, p.nama, p.email ?? "", p.alamat ?? "");
                }}
              />
              {isEdit && (
                <p className="mt-1.5 text-[11px] text-slate-400">Supplier dikunci agar rujukan faktur tetap konsisten.</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email supplier" maxLength={100} />
            </Field>
            <Field label="Alamat penagihan">
              <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Alamat supplier" maxLength={1000} />
            </Field>
            <Field label="Tanggal transaksi *">
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
            <Field label="Syarat pembayaran *" className="sm:col-span-2">
              <Select value={syarat} onChange={(e) => {
                const s = e.target.value;
                setSyarat(s);
                const jt = jatuhTempoDari(tanggal, s);
                if (jt) setJatuhTempo(jt);
              }} required>
                <option value="">Pilih syarat</option>
                {SYARAT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              {syaratKosong && (
                <p className="text-[11px] text-red-600">Syarat pembayaran wajib dipilih sebelum menyimpan.</p>
              )}
            </Field>
          </div>

          <div className="rounded-xl border border-slate-200">
            <div className="border-b border-slate-100 p-4">
              <p className="text-xs font-medium text-slate-500">
                Pilih faktur pembelian yang akan ditukar
                {supplierNama ? ` — ${supplierNama}` : ""}
              </p>
              {/* Dropdown searchable ala Mekari: langsung berisi faktur tersedia (nomor, tempo, status). */}
              <div ref={dropdownRef} className="relative mt-2">
                <button
                  type="button"
                  onClick={() => setDropdownBuka((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className={dipilih.length ? "text-slate-900" : "text-slate-400"}>
                    {dipilih.length ? `${dipilih.length} faktur dipilih` : "Pilih faktur..."}
                  </span>
                  <span className="text-xs text-slate-400">{dropdownBuka ? "▲" : "▼"}</span>
                </button>
                {dropdownBuka && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                    <div className="flex gap-2 border-b border-slate-100 p-2">
                      <Input
                        value={cari}
                        onChange={(e) => setCari(e.target.value)}
                        placeholder="Cari nomor faktur / supplier..."
                        className="flex-1"
                        autoFocus
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => muatHutang(cari)}>
                        Cari
                      </Button>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-2">
                      {memuat && <p className="py-4 text-center text-xs text-slate-400">Memuat faktur...</p>}
                      {!memuat && daftarTampil.length === 0 && (
                        <p className="py-4 text-center text-xs text-slate-400">Tidak ada utang yang tersedia</p>
                      )}
                      {daftarTampil.map((d) => {
                        const checked = dipilih.includes(d.id);
                        return (
                          <label
                            key={d.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                              checked ? "border-green-600 bg-green-50/50" : "border-transparent hover:bg-slate-50"
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
                                {d.noFaktur ?? `…${d.id.slice(-6).toUpperCase()}`} — {d.pihak}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                Tempo:{" "}
                                {d.jatuhTempo
                                  ? new Date(d.jatuhTempo).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                                  : "—"}{" "}
                                · {d.status === "LUNAS_SEBAGIAN" ? "Lunas Sebagian" : "Belum Lunas"}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Tabel detail faktur terpilih: jumlah + sisa tagihan. */}
            <div className="overflow-x-auto p-4">
              {dipilih.length === 0 ? (
                <p className="py-2 text-center text-xs text-slate-400">Belum ada faktur dipilih</p>
              ) : (
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="py-2 pr-2 font-medium">No. Faktur</th>
                      <th className="py-2 pr-2 font-medium">Jatuh Tempo</th>
                      <th className="py-2 pr-2 font-medium">Status</th>
                      <th className="py-2 pr-2 text-right font-medium">Jumlah</th>
                      <th className="py-2 pr-2 text-right font-medium">Sisa</th>
                      <th className="py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {daftar
                      .filter((d) => dipilih.includes(d.id))
                      .map((d) => (
                        <tr key={d.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 pr-2 font-medium text-slate-900">
                            {d.noFaktur ?? `…${d.id.slice(-6).toUpperCase()}`}
                            <span className="block truncate font-normal text-slate-500">{d.pihak}</span>
                          </td>
                          <td className="py-2 pr-2 text-slate-600">
                            {d.jatuhTempo
                              ? new Date(d.jatuhTempo).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                              : "—"}
                          </td>
                          <td className="py-2 pr-2 text-slate-600">
                            {d.status === "LUNAS_SEBAGIAN" ? "Lunas Sebagian" : "Belum Lunas"}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums text-slate-700">Rp {formatRupiah(d.jumlah)}</td>
                          <td className="py-2 pr-2 text-right font-medium tabular-nums text-slate-900">Rp {formatRupiah(d.sisa)}</td>
                          <td className="py-2 text-right">
                            <Button type="button" variant="outline" size="sm" onClick={() => toggle(d.id)}>
                              Hapus
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
            {dipilih.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-600">
                {dipilih.length} faktur dipilih · Total sisa Rp {formatRupiah(totalDipilih)}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pesan">
              <Textarea value={pesan} onChange={(e) => setPesan(e.target.value)} placeholder="Pesan untuk supplier (opsional)" />
            </Field>
            <Field label="Memo">
              <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Catatan internal (opsional)" />
            </Field>
            <div className="sm:col-span-2">
              <LampiranUploader value={lampiran} onAdd={tambahLampiran} onRemove={hapusLampiran} />
            </div>
          </div>
        </CardContent>
      </Card>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/keuangan/pembelian?tab=tukar-faktur")} disabled={saving}>
          Batal
        </Button>
        <Button
          type="submit"
          disabled={saving || syaratKosong}
          title={syaratKosong ? "Pilih syarat pembayaran terlebih dahulu" : undefined}
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
